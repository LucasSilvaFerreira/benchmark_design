# Exported Pipeline Runner

The exported ZIP includes a Textual terminal UI for launching and monitoring samples.

## Setup

From the unzipped run directory:

```bash
python3 -m pip install -r requirements.txt
```

The runner expects `git`, `nextflow`, and Google/Tower credentials to be available in the shell environment where you launch it. The generated `runner_manifest.json` stores the repository branch, credential paths, sample names, inputs, and output directories from the configurator export.

## Launch The TUI

```bash
./run_all.sh
```

or:

```bash
python3 pipeline_runner.py
```

Keyboard shortcuts:

- `s`: start or relaunch the selected sample
- `r`: resume the selected sample with Nextflow `-resume`
- `f`: restart the selected sample without `-resume`
- `x`: stop the selected sample
- `l`: refresh the latest log view
- `Ctrl+r`: refresh status
- `q`: quit the interface

Closing the TUI does not stop running samples. The runner starts each pipeline in its own process group and writes the PID to `<sample>/run.pid`.

## Status Without The TUI

Use these commands from the run directory:

```bash
python3 pipeline_runner.py --status
python3 pipeline_runner.py --logs Sample_1
python3 pipeline_runner.py --tail Sample_1
python3 pipeline_runner.py --resume Sample_1
python3 pipeline_runner.py --restart Sample_1
python3 pipeline_runner.py --stop Sample_1
```

State is stored in `runner_state.json`. Logs are archived under `logs/<sample>/`, and `<sample>/run.log` points to the latest log for compatibility with older workflows.
