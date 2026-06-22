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

Use `Show Resource Columns` in the configurator to edit per-sample Nextflow execution settings at the end of the sample table. The resource columns read defaults from the uploaded base `nextflow.config`, sample custom config uploads when accepted, and sample configs during Load Directory. Directory reload prefers `<sample>/CRISPR_Pipeline/nextflow.config` after the runner has cloned the pipeline, then falls back to `<sample>/nextflow.config` or `<sample>/nextflow.config.backup`. Resource columns can be force-synced like the other sample parameters, and each sample's selected resources are written into that sample's exported `nextflow.config`.

When a config does not define a resource field, the configurator falls back to the Pinello Lab CRISPR Pipeline `dev` branch `nextflow.config` baseline. Fields absent from that baseline, such as `singularity.pullTimeout`, are shown as unset.

The per-row resource profile selector provides five presets. `Large scale datasets (> 1M cells and 20k guides)` applies the requested high-end settings, including `pullTimeout = '60m'`, `max_cpus = 12`, `max_memory = 600.GB`, 600 GB MuData/AnnData merge steps, higher mapping and SCEPTRE retry resources, CLEANSER scratch/disk settings, and GPU queue fields for PerTurbo processes.

User-created resource profiles are stored in browser `localStorage` as a fallback and can be saved to a shared Supabase table on request. In the configurator, open `Show Resource Columns`, then use the `Online profiles` button in a sample row's final resource column. The online panel saves, loads, applies, and deletes profiles only when requested, and apply/save actions target the current row.

- Project URL: `https://sibzwlumosfvdidyzngu.supabase.co`
- Table: `resource_profiles`
- Client key type: Supabase publishable key

The GitHub Pages app calls the Supabase REST API directly, so it does not need a bundled SDK. A publishable key is intentionally browser-visible; keep secret/service-role keys out of this repository.

To recreate the shared prototype table in another Supabase project, run this SQL in the Supabase SQL editor:

```sql
create table if not exists public.resource_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by text,
  description text,
  values jsonb not null,
  created_at timestamptz default now()
);

alter table public.resource_profiles enable row level security;

create policy "public read resource profiles"
on public.resource_profiles
for select
to anon
using (true);

create policy "public create resource profiles"
on public.resource_profiles
for insert
to anon
with check (true);

create policy "public delete resource profiles"
on public.resource_profiles
for delete
to anon
using (true);
```

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
- `<sample>/nextflow.config`: generated per-sample config; after the runner creates `CRISPR_Pipeline/nextflow.config`, this is renamed to `<sample>/nextflow.config.backup`
- `runner_state.json`: created after first runner launch
- `logs/<sample>/`: archived run logs
- `<sample>/run.pid` and `<sample>/run.log`: compatibility files for quick status/log checks

See `RUNNER_README.md` for runner commands.
