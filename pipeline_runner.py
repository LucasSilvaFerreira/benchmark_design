#!/usr/bin/env python3
"""Textual runner for exported CRISPR pipeline bundles.

The configurator writes a runner_manifest.json file next to this script.
This runner keeps durable sample state in runner_state.json so users can close
and reopen the interface without losing track of active or previous runs.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
MANIFEST_PATH = ROOT / "runner_manifest.json"
STATE_PATH = ROOT / "runner_state.json"
LOG_ROOT = ROOT / "logs"
NEXTFLOW_VERSION = "26.03.2-edge"


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def compact_time(value: str | None) -> str:
    if not value:
        return "-"
    return value.replace("T", " ").split("+", 1)[0]


def pid_alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def read_json(path: Path, default: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        backup = path.with_suffix(path.suffix + ".broken")
        shutil.copy2(path, backup)
        return default


def write_json(path: Path, data: dict[str, Any]) -> None:
    tmp = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")
    tmp.replace(path)


def strip_quotes(value: str) -> str:
    value = value.strip().rstrip(";").strip()
    if (value.startswith("'") and value.endswith("'")) or (value.startswith('"') and value.endswith('"')):
        return value[1:-1]
    return value


def parse_assignment(path: Path, key: str) -> str | None:
    if not path.exists():
        return None
    pattern = re.compile(rf"^\s*(?:params\.)?{re.escape(key)}\s*=\s*(.+?)\s*$")
    for raw_line in path.read_text(errors="replace").splitlines():
        line = re.sub(r"(^|[^:])//.*$", r"\1", raw_line).strip()
        match = pattern.match(line)
        if match:
            return strip_quotes(match.group(1))
    return None


def parse_legacy_run_sh(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    text = path.read_text(errors="replace")
    parsed: dict[str, str] = {}
    input_match = re.search(r"--input\s+(['\"])(.*?)\1", text)
    outdir_match = re.search(r"--outdir\s+(['\"])(.*?)\1", text)
    if input_match:
        parsed["input"] = input_match.group(2)
    if outdir_match:
        parsed["outdir"] = outdir_match.group(2)
    return parsed


def tail_text(path: Path, lines: int = 160) -> str:
    if not path.exists():
        return ""
    try:
        with path.open("rb") as handle:
            handle.seek(0, os.SEEK_END)
            end = handle.tell()
            block_size = 8192
            data = b""
            while end > 0 and data.count(b"\n") <= lines:
                step = min(block_size, end)
                end -= step
                handle.seek(end)
                data = handle.read(step) + data
        text = data.decode(errors="replace")
        return "\n".join(text.splitlines()[-lines:])
    except OSError as exc:
        return f"Could not read log: {exc}"


def infer_finished_status(log_path: Path, return_code: int | None = None) -> str:
    if return_code == 0:
        return "completed"
    if return_code not in (None, 0):
        return "failed"
    text = tail_text(log_path, lines=240).lower()
    if any(marker in text for marker in ("error ~", "execution aborted", "command error", "pipeline failed", "failed")):
        return "failed"
    if any(marker in text for marker in ("completed successfully", "execution complete", "pipeline completed")):
        return "completed"
    return "finished"


@dataclass(frozen=True)
class Sample:
    name: str
    path: Path
    input: str
    outdir: str


class RunnerManager:
    def __init__(self, root: Path = ROOT) -> None:
        self.root = root
        self.manifest = self.load_manifest()
        self.samples = self.load_samples()
        self.active_processes: dict[str, subprocess.Popen[Any]] = {}
        self.state = self.load_state()
        self.refresh_state(save=True)

    def load_manifest(self) -> dict[str, Any]:
        if MANIFEST_PATH.exists():
            return json.loads(MANIFEST_PATH.read_text())

        manifest = self.build_legacy_manifest()
        if manifest:
            try:
                write_json(MANIFEST_PATH, manifest)
            except OSError:
                pass
            return manifest

        raise SystemExit(
            "runner_manifest.json is missing and no legacy session_backup.json could be reconstructed."
        )

    def build_legacy_manifest(self) -> dict[str, Any] | None:
        session_path = self.root / "session_backup.json"
        backup_path = self.root / "pipeline_config_backup.json"
        session = read_json(session_path, {}) if session_path.exists() else {}
        global_settings = session.get("globalSettings", {})
        session_samples = session.get("samples", [])

        if not session_samples and backup_path.exists():
            backup = json.loads(backup_path.read_text())
            if isinstance(backup, list):
                session_samples = [
                    {"name": item.get("sample_name"), "fileName": item.get("attached_file")}
                    for item in backup
                    if item.get("sample_name")
                ]

        if not session_samples:
            return None

        base_output_dir = global_settings.get("baseOutputDir", "")
        analysis_name = global_settings.get("analysisName", self.root.name)
        cleaned_base = base_output_dir if base_output_dir.endswith("/") else f"{base_output_dir}/"

        samples = []
        for item in session_samples:
            safe_name = str(item["name"]).replace(" ", "_")
            sample_dir = self.root / safe_name
            run_values = parse_legacy_run_sh(sample_dir / "run.sh")
            config_input = parse_assignment(sample_dir / "nextflow.config", "input")
            config_outdir = parse_assignment(sample_dir / "nextflow.config", "outdir")
            fallback_input = f"../{item.get('fileName')}" if item.get("fileName") else f"/path/to/input_for_{safe_name}.tsv"
            fallback_outdir = f"{cleaned_base}{analysis_name}/{safe_name}" if base_output_dir else f"./pipeline_outputs/{safe_name}"
            samples.append(
                {
                    "name": safe_name,
                    "path": safe_name,
                    "input": run_values.get("input") or config_input or fallback_input,
                    "outdir": run_values.get("outdir") or config_outdir or fallback_outdir,
                }
            )

        return {
            "version": "1.0",
            "generatedAt": now_iso(),
            "reconstructedFrom": "legacy_export",
            "repository": {
                "url": "https://github.com/pinellolab/CRISPR_Pipeline.git",
                "branch": global_settings.get("repoBranch", "main"),
                "base_path": ".crispr_base",
            },
            "credentials": {
                "google_application_credentials": global_settings.get("googleCreds", ""),
                "tower_access_token": global_settings.get("towerToken", ""),
            },
            "samples": samples,
        }

    def load_samples(self) -> list[Sample]:
        samples = []
        for item in self.manifest.get("samples", []):
            samples.append(
                Sample(
                    name=item["name"],
                    path=self.root / item["path"],
                    input=item["input"],
                    outdir=item["outdir"],
                )
            )
        return samples

    def load_state(self) -> dict[str, Any]:
        state = read_json(STATE_PATH, {"version": 1, "samples": {}})
        sample_state = state.setdefault("samples", {})
        for sample in self.samples:
            existing = sample_state.setdefault(sample.name, {})
            existing.setdefault("status", "not_started")
            existing.setdefault("pid", None)
            existing.setdefault("last_mode", None)
            existing.setdefault("last_run_id", None)
            existing.setdefault("last_log", None)
            existing.setdefault("started_at", None)
            existing.setdefault("finished_at", None)
            existing.setdefault("runs", [])
            self._adopt_legacy_files(sample, existing)
        return state

    def save_state(self) -> None:
        write_json(STATE_PATH, self.state)

    def sample_by_name(self, name: str) -> Sample:
        for sample in self.samples:
            if sample.name == name:
                return sample
        available = ", ".join(sample.name for sample in self.samples)
        raise ValueError(f"Unknown sample '{name}'. Available samples: {available}")

    def status_for(self, sample_name: str) -> dict[str, Any]:
        return self.state["samples"][sample_name]

    def _adopt_legacy_files(self, sample: Sample, entry: dict[str, Any]) -> None:
        pid_file = sample.path / "run.pid"
        legacy_log = sample.path / "run.log"
        if pid_file.exists():
            try:
                pid = int(pid_file.read_text().strip())
            except ValueError:
                pid = None
            if pid_alive(pid):
                entry["status"] = "running"
                entry["pid"] = pid
                entry.setdefault("started_at", now_iso())
                if legacy_log.exists() and not entry.get("last_log"):
                    entry["last_log"] = str(legacy_log.relative_to(self.root))
            elif legacy_log.exists():
                entry["status"] = infer_finished_status(legacy_log)
                entry["pid"] = None
                if not entry.get("finished_at"):
                    entry["finished_at"] = now_iso()
                if not entry.get("last_log"):
                    entry["last_log"] = str(legacy_log.relative_to(self.root))
            elif entry.get("status") == "running":
                entry["status"] = infer_finished_status(self._last_log_path(entry))
                entry["pid"] = None
        elif entry.get("status") == "running":
            entry["status"] = infer_finished_status(self._last_log_path(entry))
            entry["pid"] = None
        elif legacy_log.exists() and entry.get("status") == "not_started":
            entry["status"] = infer_finished_status(legacy_log)
            if not entry.get("finished_at"):
                entry["finished_at"] = now_iso()
            if not entry.get("last_log"):
                entry["last_log"] = str(legacy_log.relative_to(self.root))

    def _last_log_path(self, entry: dict[str, Any]) -> Path:
        if entry.get("last_log"):
            return self.root / entry["last_log"]
        return self.root / "missing.log"

    def refresh_state(self, save: bool = False) -> None:
        changed = False
        for sample in self.samples:
            entry = self.status_for(sample.name)
            pid = entry.get("pid")
            process = self.active_processes.get(sample.name)
            return_code = process.poll() if process else None
            if entry.get("status") == "running" and not pid_alive(pid):
                log_path = self._last_log_path(entry)
                entry["status"] = infer_finished_status(log_path, return_code)
                entry["pid"] = None
                entry["finished_at"] = now_iso()
                self._update_latest_run(sample.name, {"finished_at": entry["finished_at"], "return_code": return_code})
                pid_file = sample.path / "run.pid"
                if pid_file.exists():
                    pid_file.unlink()
                changed = True
            elif entry.get("status") == "running" and process and return_code is not None:
                log_path = self._last_log_path(entry)
                entry["status"] = infer_finished_status(log_path, return_code)
                entry["pid"] = None
                entry["finished_at"] = now_iso()
                self._update_latest_run(sample.name, {"finished_at": entry["finished_at"], "return_code": return_code})
                changed = True
        if save or changed:
            self.save_state()

    def _update_latest_run(self, sample_name: str, updates: dict[str, Any]) -> None:
        runs = self.status_for(sample_name).setdefault("runs", [])
        if runs:
            runs[-1].update(updates)

    def env(self) -> dict[str, str]:
        env = os.environ.copy()
        env["NXF_VER"] = NEXTFLOW_VERSION
        credentials = self.manifest.get("credentials", {})
        google_creds = credentials.get("google_application_credentials")
        tower_token = credentials.get("tower_access_token")
        if google_creds:
            env["GOOGLE_APPLICATION_CREDENTIALS"] = google_creds
        if tower_token:
            env["TOWER_ACCESS_TOKEN"] = tower_token
        return env

    def ensure_repo(self, sample: Sample, log_handle: Any) -> Path:
        repo = self.manifest.get("repository", {})
        repo_url = repo.get("url", "https://github.com/pinellolab/CRISPR_Pipeline.git")
        repo_branch = repo.get("branch", "main")
        base_repo = self.root / repo.get("base_path", ".crispr_base")
        sample_repo = sample.path / "CRISPR_Pipeline"

        if not base_repo.exists():
            log_handle.write(f"Cloning {repo_url} branch {repo_branch} into {base_repo.name}\n")
            log_handle.flush()
            subprocess.run(
                ["git", "clone", "-b", repo_branch, repo_url, str(base_repo)],
                cwd=self.root,
                env=self.env(),
                stdout=log_handle,
                stderr=subprocess.STDOUT,
                check=True,
            )

        if not sample_repo.exists():
            log_handle.write(f"Copying base repository into {sample_repo}\n")
            log_handle.flush()
            shutil.copytree(base_repo, sample_repo, symlinks=True)

        config_src = sample.path / "nextflow.config"
        config_dst = sample_repo / "nextflow.config"
        shutil.copy2(config_src, config_dst)
        return sample_repo

    def start_sample(self, sample_name: str, mode: str) -> str:
        sample = self.sample_by_name(sample_name)
        self.refresh_state()
        entry = self.status_for(sample.name)
        if entry.get("status") == "running" and pid_alive(entry.get("pid")):
            return f"{sample.name} is already running as PID {entry.get('pid')}."

        run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        sample_log_dir = LOG_ROOT / sample.name
        sample_log_dir.mkdir(parents=True, exist_ok=True)
        log_path = sample_log_dir / f"{run_id}_{mode}.log"
        legacy_log = sample.path / "run.log"
        pid_file = sample.path / "run.pid"

        entry.update(
            {
                "status": "starting",
                "pid": None,
                "last_mode": mode,
                "last_run_id": run_id,
                "last_log": str(log_path.relative_to(self.root)),
                "started_at": now_iso(),
                "finished_at": None,
            }
        )
        entry.setdefault("runs", []).append(
            {
                "run_id": run_id,
                "mode": mode,
                "pid": None,
                "log": str(log_path.relative_to(self.root)),
                "started_at": entry["started_at"],
                "finished_at": None,
                "return_code": None,
            }
        )
        self.save_state()

        with log_path.open("a", buffering=1) as log_handle:
            log_handle.write(f"Run started: {entry['started_at']}\n")
            log_handle.write(f"Sample: {sample.name}\n")
            log_handle.write(f"Mode: {mode}\n")
            log_handle.write(f"Input: {sample.input}\n")
            log_handle.write(f"Outdir: {sample.outdir}\n\n")
            try:
                repo_path = self.ensure_repo(sample, log_handle)
            except Exception as exc:
                log_handle.write(f"\nRunner setup failed: {exc}\n")
                entry["status"] = "failed"
                entry["finished_at"] = now_iso()
                self._update_latest_run(sample.name, {"finished_at": entry["finished_at"], "return_code": 1})
                self.save_state()
                return f"{sample.name} setup failed. See {log_path}."

            command = [
                "nextflow",
                "run",
                "main.nf",
                "-profile",
                "google",
                "--input",
                sample.input,
                "--outdir",
                sample.outdir,
                "--with_tower",
            ]
            if mode == "resume":
                command.append("-resume")

            log_handle.write("Command: " + " ".join(command) + "\n\n")
            log_handle.flush()

            try:
                process = subprocess.Popen(
                    command,
                    cwd=repo_path,
                    env=self.env(),
                    stdout=log_handle,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )
            except Exception as exc:
                log_handle.write(f"\nFailed to start Nextflow: {exc}\n")
                entry["status"] = "failed"
                entry["finished_at"] = now_iso()
                self._update_latest_run(sample.name, {"finished_at": entry["finished_at"], "return_code": 1})
                self.save_state()
                return f"{sample.name} failed to start. See {log_path}."

        self.active_processes[sample.name] = process
        pid_file.write_text(str(process.pid) + "\n")
        self._point_legacy_log(legacy_log, log_path)
        entry["status"] = "running"
        entry["pid"] = process.pid
        self._update_latest_run(sample.name, {"pid": process.pid})
        self.save_state()
        return f"{sample.name} started in {mode} mode as PID {process.pid}."

    def _point_legacy_log(self, legacy_log: Path, log_path: Path) -> None:
        try:
            if legacy_log.exists() or legacy_log.is_symlink():
                legacy_log.unlink()
            legacy_log.symlink_to(os.path.relpath(log_path, legacy_log.parent))
        except OSError:
            legacy_log.write_text(f"Latest log: {log_path}\n")

    def stop_sample(self, sample_name: str) -> str:
        sample = self.sample_by_name(sample_name)
        entry = self.status_for(sample.name)
        pid = entry.get("pid")
        pid_file = sample.path / "run.pid"
        if not pid and pid_file.exists():
            try:
                pid = int(pid_file.read_text().strip())
            except ValueError:
                pid = None
        if not pid or not pid_alive(pid):
            entry["status"] = "stopped"
            entry["pid"] = None
            entry["finished_at"] = now_iso()
            if pid_file.exists():
                pid_file.unlink()
            self.save_state()
            return f"{sample.name} was not running."

        try:
            os.killpg(pid, signal.SIGTERM)
            time.sleep(1)
            if pid_alive(pid):
                os.killpg(pid, signal.SIGKILL)
        except ProcessLookupError:
            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        except PermissionError:
            os.kill(pid, signal.SIGTERM)

        if pid_file.exists():
            pid_file.unlink()
        entry["status"] = "stopped"
        entry["pid"] = None
        entry["finished_at"] = now_iso()
        self._update_latest_run(sample.name, {"finished_at": entry["finished_at"], "return_code": -15})
        self.save_state()
        return f"{sample.name} stopped."

    def logs_for_sample(self, sample_name: str) -> list[Path]:
        self.sample_by_name(sample_name)
        paths = []
        last_log = self.status_for(sample_name).get("last_log")
        if last_log:
            path = self.root / last_log
            if path.exists():
                paths.append(path)
        for run in self.status_for(sample_name).get("runs", []):
            if run.get("log"):
                path = self.root / run["log"]
                if path.exists():
                    paths.append(path)
        log_dir = LOG_ROOT / sample_name
        if log_dir.exists():
            for path in log_dir.glob("*.log"):
                if path not in paths:
                    paths.append(path)
        unique_paths = list(dict.fromkeys(paths))
        return sorted(unique_paths, key=lambda p: p.stat().st_mtime if p.exists() else 0, reverse=True)

    def latest_log_tail(self, sample_name: str, lines: int = 160) -> str:
        logs = self.logs_for_sample(sample_name)
        if not logs:
            return "No log file has been created for this sample yet."
        return tail_text(logs[0], lines=lines)

    def rows(self) -> list[list[str]]:
        self.refresh_state()
        rows = []
        for sample in self.samples:
            entry = self.status_for(sample.name)
            rows.append(
                [
                    sample.name,
                    str(entry.get("status", "not_started")),
                    str(entry.get("pid") or "-"),
                    str(entry.get("last_mode") or "-"),
                    compact_time(entry.get("started_at")),
                    compact_time(entry.get("finished_at")),
                    str(entry.get("last_log") or "-"),
                ]
            )
        return rows


def print_status(manager: RunnerManager) -> None:
    headers = ["sample", "status", "pid", "mode", "started", "finished"]
    rows = [row[:6] for row in manager.rows()]
    widths = [max(len(str(item)) for item in [header] + [row[index] for row in rows]) for index, header in enumerate(headers)]
    print("  ".join(header.ljust(widths[index]) for index, header in enumerate(headers)))
    print("  ".join("-" * width for width in widths))
    for row in rows:
        print("  ".join(row[index].ljust(widths[index]) for index in range(len(headers))))


def run_tui(manager: RunnerManager) -> None:
    try:
        from rich.text import Text
        from textual.app import App, ComposeResult
        from textual.containers import Horizontal, Vertical
        from textual.widgets import Button, DataTable, Footer, Header, Static
    except ModuleNotFoundError:
        print("Textual is not installed.")
        print("Install it with: python3 -m pip install -r requirements.txt")
        print("CLI status still works with: python3 pipeline_runner.py --status")
        raise SystemExit(1)

    class PipelineRunnerApp(App[None]):
        CSS = """
        Screen {
            layout: vertical;
            background: #0f172a;
        }
        #summary {
            height: 3;
            padding: 0 1;
            background: #111827;
            color: #e5e7eb;
        }
        #main {
            height: 1fr;
        }
        #table {
            width: 58%;
            height: 1fr;
            margin: 1;
        }
        #side {
            width: 42%;
            height: 1fr;
            margin: 1 1 1 0;
        }
        #actions {
            height: 3;
        }
        #details {
            height: 8;
            border: round #334155;
            padding: 1;
            color: #d1d5db;
        }
        #log {
            height: 1fr;
            border: round #334155;
            padding: 1;
            color: #d1d5db;
        }
        Button {
            margin: 0 1 0 0;
        }
        """

        BINDINGS = [
            ("q", "quit", "Quit"),
            ("s", "start", "Start"),
            ("r", "resume", "Resume"),
            ("f", "restart", "Restart"),
            ("x", "stop", "Stop"),
            ("l", "refresh_log", "Logs"),
            ("ctrl+r", "refresh", "Refresh"),
        ]

        def __init__(self, runner: RunnerManager) -> None:
            super().__init__()
            self.runner = runner
            self.selected_sample = runner.samples[0].name if runner.samples else ""
            self.message = "Select a sample and use the buttons or keyboard shortcuts."

        def compose(self) -> ComposeResult:
            yield Header(show_clock=True)
            yield Static("", id="summary")
            with Horizontal(id="main"):
                yield DataTable(id="table")
                with Vertical(id="side"):
                    with Horizontal(id="actions"):
                        yield Button("Start", id="start", variant="primary")
                        yield Button("Resume", id="resume")
                        yield Button("Restart", id="restart", variant="warning")
                        yield Button("Stop", id="stop", variant="error")
                    yield Static("", id="details")
                    yield Static("", id="log")
            yield Footer()

        def on_mount(self) -> None:
            table = self.query_one("#table", DataTable)
            table.cursor_type = "row"
            table.zebra_stripes = True
            table.add_columns("Sample", "Status", "PID", "Mode", "Started", "Finished")
            self.refresh_all()
            self.set_interval(2.0, self.refresh_all)
            table.focus()

        def refresh_all(self) -> None:
            self.runner.refresh_state(save=True)
            table = self.query_one("#table", DataTable)
            table.clear(columns=False)
            status_counts: dict[str, int] = {}
            for row in self.runner.rows():
                sample, status, pid, mode, started, finished, _log = row
                status_counts[status] = status_counts.get(status, 0) + 1
                table.add_row(sample, status.upper(), pid, mode, started, finished, key=sample)
            summary = "  ".join(f"{status}: {count}" for status, count in sorted(status_counts.items()))
            self.query_one("#summary", Static).update(f"CRISPR Pipeline Runner | {summary or 'no samples'} | {self.message}")
            self.update_details()

        def update_details(self) -> None:
            if not self.selected_sample:
                return
            entry = self.runner.status_for(self.selected_sample)
            latest_logs = self.runner.logs_for_sample(self.selected_sample)
            log_names = "\n".join(str(path.relative_to(self.runner.root)) for path in latest_logs[:5]) or "No logs yet."
            details = (
                f"Sample: {self.selected_sample}\n"
                f"Status: {entry.get('status', 'not_started')}    PID: {entry.get('pid') or '-'}\n"
                f"Last mode: {entry.get('last_mode') or '-'}    Last run: {entry.get('last_run_id') or '-'}\n"
                f"Started: {compact_time(entry.get('started_at'))}    Finished: {compact_time(entry.get('finished_at'))}\n"
                f"Recent logs:\n{log_names}"
            )
            self.query_one("#details", Static).update(details)
            log_tail = self.runner.latest_log_tail(self.selected_sample, lines=120)
            self.query_one("#log", Static).update(Text.from_ansi(log_tail))

        def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
            self.selected_sample = str(event.row_key.value)
            self.update_details()

        def on_data_table_row_highlighted(self, event: DataTable.RowHighlighted) -> None:
            self.selected_sample = str(event.row_key.value)
            self.update_details()

        def on_button_pressed(self, event: Button.Pressed) -> None:
            if event.button.id == "start":
                self.action_start()
            elif event.button.id == "resume":
                self.action_resume()
            elif event.button.id == "restart":
                self.action_restart()
            elif event.button.id == "stop":
                self.action_stop()

        def action_start(self) -> None:
            self.message = self.runner.start_sample(self.selected_sample, "start")
            self.refresh_all()

        def action_resume(self) -> None:
            self.message = self.runner.start_sample(self.selected_sample, "resume")
            self.refresh_all()

        def action_restart(self) -> None:
            self.message = self.runner.start_sample(self.selected_sample, "restart")
            self.refresh_all()

        def action_stop(self) -> None:
            self.message = self.runner.stop_sample(self.selected_sample)
            self.refresh_all()

        def action_refresh(self) -> None:
            self.message = "Status refreshed."
            self.refresh_all()

        def action_refresh_log(self) -> None:
            self.message = f"Showing latest log for {self.selected_sample}."
            self.update_details()

    PipelineRunnerApp(manager).run()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run, resume, restart, and inspect exported pipeline samples.")
    parser.add_argument("--status", action="store_true", help="print durable sample status and exit")
    parser.add_argument("--start", metavar="SAMPLE", help="start or relaunch a sample without -resume")
    parser.add_argument("--resume", metavar="SAMPLE", help="start a sample with Nextflow -resume")
    parser.add_argument("--restart", metavar="SAMPLE", help="restart a sample from scratch")
    parser.add_argument("--stop", metavar="SAMPLE", help="stop a running sample")
    parser.add_argument("--logs", metavar="SAMPLE", help="list logs for a sample")
    parser.add_argument("--tail", metavar="SAMPLE", help="print the latest log tail for a sample")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    manager = RunnerManager()

    if args.status:
        print_status(manager)
        return 0
    if args.start:
        print(manager.start_sample(args.start, "start"))
        return 0
    if args.resume:
        print(manager.start_sample(args.resume, "resume"))
        return 0
    if args.restart:
        print(manager.start_sample(args.restart, "restart"))
        return 0
    if args.stop:
        print(manager.stop_sample(args.stop))
        return 0
    if args.logs:
        logs = manager.logs_for_sample(args.logs)
        if not logs:
            print(f"No logs found for {args.logs}.")
        for path in logs:
            print(path.relative_to(manager.root))
        return 0
    if args.tail:
        print(manager.latest_log_tail(args.tail))
        return 0

    run_tui(manager)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
