# Pipeline Sample Configurator

Static GitHub Pages app for creating per-sample CRISPR pipeline run bundles.

## Use On GitHub Pages

Publish this directory with GitHub Pages. The entrypoint is `index.html`; it loads `pipeline_configurator (1).tsx`, `pipeline_runner.py`, `requirements.txt`, and `RUNNER_README.md` from the same directory.

The page includes three tabs:

- `Configurator`: the sample table and export workflow.
- `GitHub & Install`: links to the CRISPR pipeline repository/docs and dependency setup commands.
- `How To Use`: a compact runbook for configuring, exporting, launching, checking logs, and resuming samples.

`GUIDE_ASSIGNMENT_capture_method` is a dropdown with the documented pipeline values `crop-seq` and `direct-capture`.

## Computational Resources

Open `Computational Resource Parameters` in the configurator to edit global Nextflow execution settings. The panel reads defaults from the uploaded base `nextflow.config`, sample custom config uploads when accepted, and actual sample `nextflow.config` files during Load Directory. It shows those config defaults under each input and writes the selected overrides into every exported sample `nextflow.config`.

The resource profile selector provides five presets. `Large scale datasets (> 1M cells and 20k guides)` applies the requested high-end settings, including `pullTimeout = '60m'`, `max_cpus = 12`, `max_memory = 600.GB`, 600 GB MuData/AnnData merge steps, higher mapping and SCEPTRE retry resources, CLEANSER scratch/disk settings, and GPU queue fields for PerTurbo processes.

## Local Preview

Because the page fetches local assets, serve it through a local HTTP server instead of opening the file directly:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Exported Run Bundles

The exported ZIP contains:

- `run_all.sh`: launcher for the Textual runner
- `pipeline_runner.py`: TUI and CLI runner
- `runner_manifest.json`: generated sample metadata
- `runner_state.json`: created after first runner launch
- `logs/<sample>/`: archived run logs
- `<sample>/run.pid` and `<sample>/run.log`: compatibility files for quick status/log checks

See `RUNNER_README.md` for runner commands.
