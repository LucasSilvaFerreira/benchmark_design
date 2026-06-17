import React, { useState, useMemo, useRef } from 'react';
import { Download, Plus, Trash2, Upload, Link, Link2Off, FileType, Check, AlignLeft, Info, Terminal, FolderOpen, Save, Github, KeyRound, Shield } from 'lucide-react';

// --- Schema Definition ---
// Priority fields are ordered first.
const paramSchema = [
  // Priority Fields
  { key: 'ENABLE_DATA_HASHING', type: 'boolean', default: false, priority: true },
  { key: 'spacer_tag', type: 'string', default: 'GAGTACATGGGG', priority: true, maxLength: 12, placeholder: 'Max 12 chars' },
  { key: 'Multiplicity_of_infection', type: 'select', options: ['high', 'low'], default: 'high', priority: true },
  { key: 'GUIDE_ASSIGNMENT_method', type: 'select', options: ['sceptre', 'cleanser'], default: 'sceptre', priority: true },
  
  // Default Fields
  { key: 'scrna_workflow', type: 'select', options: ['standard', 'nac'], default: 'standard' },
  { key: 'use_multimapping', type: 'boolean', default: false },
  { key: 'replace_barcodes', type: 'boolean', default: false },
  { key: 'bc_replacement_file', type: 'string', default: '', placeholder: 'e.g. assets/barcode_...tsv' },
  { key: 'ENABLE_SCRUBLET', type: 'boolean', default: false },
  { key: 'use_igvf_reference', type: 'boolean', default: true },
  { key: 'is_10x3v3', type: 'boolean', default: true },
  { key: 'reverse_complement_guides', type: 'boolean', default: false },
  { key: 'DUAL_GUIDE', type: 'boolean', default: false },
  
  { key: 'REFERENCE_transcriptome', type: 'string', default: 'human' },
  { key: 'REFERENCE_gtf_download_path', type: 'string', default: 'https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_43/gencode.v43.annotation.gtf.gz' },
  { key: 'REFERENCE_gtf_local_path', type: 'string', default: '/path/to/gencode_gtf.gtf.gz' },

  { key: 'QC_min_genes_per_cell', type: 'number', default: 800, min: 0 },
  { key: 'QC_min_cells_per_gene', type: 'number', default: 0.05, min: 0, max: 1.0, step: 0.01 },
  { key: 'QC_pct_mito', type: 'number', default: 15, min: 0, max: 100 },
  { key: 'QC_batch_col', type: 'string', default: 'batch' },
  { key: 'QC_barcode_filter', type: 'select', options: ['none', 'knee', 'knee2'], default: 'knee2' },
  
  { key: 'GUIDE_ASSIGNMENT_capture_method', type: 'string', default: 'crop-seq' },
  { key: 'GUIDE_ASSIGNMENT_cleanser_probability_threshold', type: 'number', default: 1 },
  { key: 'GUIDE_ASSIGNMENT_SCEPTRE_probability_threshold', type: 'string', default: '0.8' },
  { key: 'GUIDE_ASSIGNMENT_SCEPTRE_n_em_rep', type: 'string', default: '5' },
  
  { key: 'INFERENCE_method', type: 'string', default: 'default' },
  { key: 'INFERENCE_input_mudata', type: 'string', default: '', placeholder: 'path/to/mudata' },
  { key: 'INFERENCE_target_guide_pairing_strategy', type: 'string', default: 'default' },
  { key: 'INFERENCE_PERTURBO_BATCH_SIZE', type: 'number', default: 4096 },
  { key: 'INFERENCE_PERTURBO_TRANS_MAX_GENES_PER_CHUNK', type: 'number', default: 8000 },
  { key: 'INFERENCE_predefined_pairs_to_test', type: 'string', default: '', placeholder: 'path/to/pairs.csv' },
  { key: 'INFERENCE_max_target_distance_bp', type: 'number', default: 1000000 },
  { key: 'INFERENCE_SCEPTRE_side', type: 'select', options: ['both', 'left', 'right'], default: 'both' },
  { key: 'INFERENCE_SCEPTRE_grna_integration_strategy', type: 'string', default: 'union' },
  { key: 'INFERENCE_SCEPTRE_resampling_approximation', type: 'string', default: 'skew_normal' },
  { key: 'INFERENCE_SCEPTRE_control_group', type: 'string', default: 'complement' },
  { key: 'INFERENCE_SCEPTRE_resampling_mechanism', type: 'string', default: 'default' },
  { key: 'INFERENCE_SCEPTRE_formula_object', type: 'string', default: 'default' },
  { key: 'INFERENCE_SCEPTRE_CHUNK_MODE', type: 'string', default: 'auto' },
  { key: 'INFERENCE_SCEPTRE_MAX_MATRIX_ENTRIES', type: 'number', default: 2147483647 },
  { key: 'INFERENCE_SCEPTRE_GENE_CHUNK_SIZE', type: 'number', default: 1000 },
  { key: 'INFERENCE_SCEPTRE_FORCE_CHUNK', type: 'boolean', default: false },

  { key: 'NETWORK_custom_central_nodes', type: 'string', default: 'undefined' },
  { key: 'NETWORK_central_nodes_num', type: 'number', default: 1 },

  { key: 'ENABLE_BENCHMARK', type: 'boolean', default: true },
  { key: 'ENCODE_BED_DIR', type: 'string', default: 'encode_bed_files' },
  { key: 'DEBUG_VAR', type: 'boolean', default: true }
];

// Sort schema to ensure priority fields are first
const sortedSchema = [...paramSchema].sort((a, b) => {
  if (a.priority && !b.priority) return -1;
  if (!a.priority && b.priority) return 1;
  return 0;
});

const generateDefaultParams = () => {
  const defaults = {};
  sortedSchema.forEach(field => {
    defaults[field.key] = field.default;
  });
  return defaults;
};

// --- Config File Parser ---
const parseConfigFile = (content, schema) => {
  const extractedParams = {};
  const lines = content.split('\n');
  
  lines.forEach(line => {
    // Strip inline comments (ignoring `://` inside URLs) and trim whitespace
    let cleanLine = line.replace(/(^|[^:])\/\/.*$/, '$1').trim();
    
    // Match standard assignments like `key = value` or `params.key = 'value'`
    const match = cleanLine.match(/^\s*(?:params\.)?([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
    if (match) {
      const key = match[1];
      let rawVal = match[2].replace(/;$/, '').trim(); // Clean trailing semicolons
      
      // Strip outer quotes if it's a string
      rawVal = rawVal.replace(/^['"](.*)['"]$/, '$1');

      const schemaField = schema.find(f => f.key === key);
      if (schemaField) {
        if (schemaField.type === 'boolean') {
          extractedParams[key] = (rawVal === 'true');
        } else if (schemaField.type === 'number') {
          // Fallback to default if NaN occurs from bad config
          const num = Number(rawVal);
          extractedParams[key] = isNaN(num) ? schemaField.default : num;
        } else {
          extractedParams[key] = rawVal;
        }
      }
    }
  });
  
  return extractedParams;
};

export default function App() {
  const [samples, setSamples] = useState([
    { 
      id: crypto.randomUUID(), 
      name: 'Sample 1', 
      file: null, 
      fileName: '', 
      sampleConfigFileName: '', 
      sampleConfigContent: '', 
      params: generateDefaultParams() 
    }
  ]);
  const [forcedColumns, setForcedColumns] = useState({});
  const fileInputRefs = useRef({});
  
  // New Global Settings State
  const [baseOutputDir, setBaseOutputDir] = useState('gs://igvf-pertub-seq-pipeline-data/scratch/bioinfolucas/');
  const [analysisName, setAnalysisName] = useState('low_moi_merge');
  
  // New Credentials State
  const [towerToken, setTowerToken] = useState('');
  const [googleCreds, setGoogleCreds] = useState('./pipeline-service-key.json');
  const [repoBranch, setRepoBranch] = useState('main');
  
  // File state for main.nf / base config
  const [mainNfContent, setMainNfContent] = useState('');
  const [mainNfFileName, setMainNfFileName] = useState('');

  // --- Handlers ---
  const addSample = () => {
    // If there are forced columns, inherit their values from the first sample
    const newParams = generateDefaultParams();
    if (samples.length > 0) {
      Object.keys(forcedColumns).forEach(key => {
        if (forcedColumns[key]) {
          newParams[key] = samples[0].params[key];
        }
      });
    }
    
    setSamples([...samples, { 
      id: crypto.randomUUID(), 
      name: `Sample_${samples.length + 1}`, 
      file: null, 
      fileName: '',
      sampleConfigFileName: '',
      sampleConfigContent: '',
      params: newParams 
    }]);
  };

  const removeSample = (id) => {
    if (samples.length <= 1) return;
    setSamples(samples.filter(s => s.id !== id));
  };

  const updateSampleName = (id, newName) => {
    // Automatically replace spaces with underscores
    const safeName = newName.replace(/\s+/g, '_');
    setSamples(samples.map(s => s.id === id ? { ...s, name: safeName } : s));
  };

  const updateParam = (sampleId, key, value) => {
    if (forcedColumns[key]) {
      // Force update across all samples
      setSamples(samples.map(s => ({ ...s, params: { ...s.params, [key]: value } })));
    } else {
      // Update individual sample
      setSamples(samples.map(s => s.id === sampleId ? { ...s, params: { ...s.params, [key]: value } } : s));
    }
  };

  const toggleForceColumn = (key) => {
    setForcedColumns(prev => {
      const isForcedNow = !prev[key];
      if (isForcedNow && samples.length > 0) {
        // Sync all rows to the value of the first row immediately upon forcing
        const firstValue = samples[0].params[key];
        setSamples(currentSamples => 
          currentSamples.map(s => ({ ...s, params: { ...s.params, [key]: firstValue } }))
        );
      }
      return { ...prev, [key]: isForcedNow };
    });
  };

  const handleFileUpload = (id, event) => {
    const file = event.target.files[0];
    if (file) {
      setSamples(samples.map(s => s.id === id ? { ...s, file: file, fileName: file.name } : s));
    }
  };

  const handleSampleConfigUpload = (id, event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const parsedParams = parseConfigFile(content, paramSchema);

        setSamples(prevSamples => prevSamples.map(s => {
          const isTarget = s.id === id;
          const newParams = { ...s.params };
          
          Object.keys(parsedParams).forEach(key => {
             // If a column is forced, loading a config updates ALL rows for that column
             if (forcedColumns[key]) {
                newParams[key] = parsedParams[key];
             } 
             // Otherwise, only update the targeted row
             else if (isTarget) {
                newParams[key] = parsedParams[key];
             }
          });

          return {
             ...s,
             ...(isTarget ? { sampleConfigFileName: file.name, sampleConfigContent: content } : {}),
             params: newParams
          };
        }));
      };
      reader.readAsText(file);
    }
    event.target.value = ''; // Reset input
  };

  const handleMainNfUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setMainNfFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        setMainNfContent(content);
        
        // Find parameters in the global config
        const parsedParams = parseConfigFile(content, paramSchema);
        if (Object.keys(parsedParams).length > 0) {
           // Prevent silent overwriting of loaded sessions/directories
           const applyToTable = window.confirm(
             "Do you want to automatically extract and apply the parameters found in this Base Config to all your current samples?\n\n(Click 'Cancel' to keep your current table values and just attach this file as the base for exporting)."
           );
           
           if (applyToTable) {
             setSamples(prevSamples => prevSamples.map(sample => ({
                ...sample,
                params: { ...sample.params, ...parsedParams }
             })));
           }
        }
      };
      reader.readAsText(file);
    }
    event.target.value = ''; // Reset input
  };

  const saveSession = () => {
    const sessionData = {
      version: "1.0",
      globalSettings: { 
        baseOutputDir, 
        analysisName, 
        towerToken, 
        googleCreds,
        repoBranch,
        mainNfContent,   // <--- Safely capturing the base config data
        mainNfFileName   // <--- Safely capturing the base config filename
      },
      forcedColumns,
      samples: samples.map(sample => ({
        id: sample.id,
        name: sample.name,
        fileName: sample.fileName,
        sampleConfigFileName: sample.sampleConfigFileName,
        sampleConfigContent: sample.sampleConfigContent,
        params: { ...sample.params }
      }))
    };

    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${analysisName || 'pipeline'}_session.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadSession = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Handle new full-session format
        if (data.version && data.samples) {
          if (data.globalSettings) {
            setBaseOutputDir(data.globalSettings.baseOutputDir || '');
            setAnalysisName(data.globalSettings.analysisName || '');
            setTowerToken(data.globalSettings.towerToken || '');
            setGoogleCreds(data.globalSettings.googleCreds || './pipeline-service-key.json');
            setRepoBranch(data.globalSettings.repoBranch || 'main');
            setMainNfContent(data.globalSettings.mainNfContent || '');   // <--- Restoring base config
            setMainNfFileName(data.globalSettings.mainNfFileName || ''); // <--- Restoring base filename
          }
          if (data.forcedColumns) {
            setForcedColumns(data.forcedColumns);
          }
          const restoredSamples = data.samples.map(s => ({
            ...s,
            file: null // The file handle is null, but the strings/data attached are safe
          }));
          setSamples(restoredSamples);
        } 
        // Fallback for older export format (array of objects)
        else if (Array.isArray(data)) {
          const restoredSamples = data.map(s => ({
            id: crypto.randomUUID(),
            name: s.sample_name || 'Restored Sample',
            file: null,
            fileName: s.attached_file || '',
            sampleConfigFileName: '',
            sampleConfigContent: '',
            params: { ...generateDefaultParams(), ...s.parameters }
          }));
          setSamples(restoredSamples);
        } else {
          alert('Unrecognized session file format.');
        }
      } catch (error) {
        alert('Failed to parse session file. Please ensure it is a valid JSON file.');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input so the same file can be uploaded again if needed
  };

  const handleDirectoryUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files || files.length === 0) return;

    const sessionFile = files.find(f => f.name === 'session_backup.json');
    if (!sessionFile) {
      alert("Could not find session_backup.json in the selected directory. Make sure you select a previously exported run directory.");
      return;
    }

    try {
      // Read the session backup as the structural foundation
      const sessionText = await sessionFile.text();
      const data = JSON.parse(sessionText);

      if (data.version && data.samples) {
        if (data.globalSettings) {
          setBaseOutputDir(data.globalSettings.baseOutputDir || '');
          setAnalysisName(data.globalSettings.analysisName || '');
          setTowerToken(data.globalSettings.towerToken || '');
          setGoogleCreds(data.globalSettings.googleCreds || './pipeline-service-key.json');
          setRepoBranch(data.globalSettings.repoBranch || 'main');
          setMainNfContent(data.globalSettings.mainNfContent || '');
          setMainNfFileName(data.globalSettings.mainNfFileName || '');
        }
        if (data.forcedColumns) {
          setForcedColumns(data.forcedColumns);
        }
        
        // Asynchronously process all samples to read their actual config files from the directory
        const restoredSamples = await Promise.all(data.samples.map(async (s) => {
          const safeName = s.name.replace(/\s+/g, '_');
          let foundFile = null;
          if (s.fileName) {
            // Try to find the actual File object inside the uploaded directory to re-attach it
            foundFile = files.find(f => f.webkitRelativePath.endsWith(`${safeName}/${s.fileName}`)) || null;
          }

          let finalParams = { ...s.params };

          // Dynamically read the actual nextflow.config from the sample directory
          // This ensures if the user manually modified the configs after exporting, we capture those updates!
          const sampleConfigFile = files.find(f => f.webkitRelativePath.endsWith(`${safeName}/nextflow.config`));
          if (sampleConfigFile) {
            try {
              const configText = await sampleConfigFile.text();
              const parsedParams = parseConfigFile(configText, paramSchema);
              // Merge/Override with the parameters actually found in the sample's directory config
              finalParams = { ...finalParams, ...parsedParams };
            } catch (err) {
              console.warn(`Could not read config for ${safeName}`, err);
            }
          }

          return {
            ...s,
            file: foundFile, // Restore the actual File object!
            params: finalParams
          };
        }));

        setSamples(restoredSamples);
      } else {
        alert("Invalid session_backup.json format.");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to parse session_backup.json or read directory files.");
    }
    
    event.target.value = ''; // Reset input
  };

  const exportZip = async () => {
    // 1. Mandatory Base Config Validation
    if (!mainNfContent) {
      alert("A Base Config File (.config) is mandatory. Please upload your global nextflow.config file before exporting.");
      return;
    }

    // Dynamically load JSZip to ensure broad compatibility
    const JSZipModule = await import('https://esm.sh/jszip');
    const JSZip = JSZipModule.default || JSZipModule;
    const zip = new JSZip();

    // 1. Save current session backup so it can be fully restored via Load Directory
    const sessionData = {
      version: "1.0",
      globalSettings: { 
        baseOutputDir, 
        analysisName, 
        towerToken, 
        googleCreds,
        repoBranch,
        mainNfContent,
        mainNfFileName
      },
      forcedColumns,
      samples: samples.map(sample => ({
        id: sample.id,
        name: sample.name,
        fileName: sample.fileName,
        sampleConfigFileName: sample.sampleConfigFileName,
        sampleConfigContent: sample.sampleConfigContent,
        params: { ...sample.params }
      }))
    };
    zip.file("session_backup.json", JSON.stringify(sessionData, null, 2));

    // Also save the legacy JSON config format backup just in case
    const exportData = samples.map(sample => {
      const finalParams = { ...sample.params };
      if (finalParams.GUIDE_ASSIGNMENT_method === 'cleanser') {
        finalParams.GUIDE_ASSIGNMENT_capture_method = finalParams.GUIDE_ASSIGNMENT_capture_method.toLowerCase();
      }
      return {
        sample_name: sample.name,
        attached_file: sample.fileName || null,
        parameters: finalParams
      };
    });
    zip.file("pipeline_config_backup.json", JSON.stringify(exportData, null, 2));

    // 2. Save Metro Map SVG
    const svgElement = document.getElementById('metro-map-svg');
    if (svgElement) {
      const clonedSvg = svgElement.cloneNode(true);
      if (!clonedSvg.getAttribute('xmlns')) {
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clonedSvg);
      zip.file("metro_map.svg", svgString);
    }

    const loadTextAsset = async (path, fallbackContent = '') => {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (response.ok) return await response.text();
      } catch (error) {
        console.warn(`Could not load ${path}`, error);
      }
      return fallbackContent;
    };

    const runnerSamples = [];
    const runnerManifest = {
      version: "1.0",
      generatedAt: new Date().toISOString(),
      repository: {
        url: "https://github.com/pinellolab/CRISPR_Pipeline.git",
        branch: repoBranch || 'main',
        base_path: ".crispr_base"
      },
      credentials: {
        google_application_credentials: googleCreds,
        tower_access_token: towerToken
      },
      samples: runnerSamples
    };

    // 3. Create sample directories
    for (const sample of samples) {
      const safeSampleName = sample.name.replace(/\s+/g, '_');
      const folder = zip.folder(safeSampleName);
      
      const cleanedBaseDir = baseOutputDir.endsWith('/') ? baseOutputDir : `${baseOutputDir}/`;
      const outdir = `${cleanedBaseDir}${analysisName}/${safeSampleName}`;
      
      // Package the data file into the ZIP if it was uploaded (Explicitly read ArrayBuffer to ensure JSZip packages it)
      if (sample.file) {
        const arrayBuffer = await sample.file.arrayBuffer();
        folder.file(sample.fileName, arrayBuffer);
      }

      // Execution will be inside Sample_Name/CRISPR_Pipeline
      // Therefore, path to input is just ../filename
      const inputFile = sample.file ? `../${sample.fileName}` : (sample.fileName || `/path/to/input_for_${safeSampleName}.tsv`);

      const finalParams = { ...sample.params };
      if (finalParams.GUIDE_ASSIGNMENT_method === 'cleanser') {
        finalParams.GUIDE_ASSIGNMENT_capture_method = finalParams.GUIDE_ASSIGNMENT_capture_method.toLowerCase();
      }

      const allParams = { input: inputFile, outdir: outdir, ...finalParams };

      // ALWAYS use the Base Config as the sole foundation.
      // The sample.params already hold the overridden values from the UI (which includes any Custom Config uploads).
      let nfConfigContent = mainNfContent;
      const replacedParams = new Set();

      // Modify the config by injecting the UI parameter values
      Object.entries(allParams).forEach(([key, val]) => {
        const valStr = typeof val === 'string' ? `'${val}'` : val;
        // Match lines like `key = value` or `params.key = value` and capture the prefix
        // This safely ignores blocks like process { ... } or docker { ... }
        const regex = new RegExp(`^([ \\t]*(?:params\\.)?${key}[ \\t]*=[ \\t]*).*$`, 'gm');
        if (regex.test(nfConfigContent)) {
          nfConfigContent = nfConfigContent.replace(regex, `$1${valStr}`);
          replacedParams.add(key);
        }
      });

      // Append any parameters that weren't found in the base config to the end
      const missingParams = Object.entries(allParams).filter(([k]) => !replacedParams.has(k));
      if (missingParams.length > 0) {
        nfConfigContent += '\n\n// --- Auto-injected by Pipeline Configurator ---\nparams {\n';
        missingParams.forEach(([key, val]) => {
          const valStr = typeof val === 'string' ? `'${val}'` : val;
          nfConfigContent += `  ${key} = ${valStr}\n`;
        });
        nfConfigContent += '}\n';
      }

      // Save the final substituted parameters as a single nextflow.config inside the folder
      folder.file('nextflow.config', nfConfigContent);
      
      runnerManifest.samples.push({
        name: safeSampleName,
        path: safeSampleName,
        input: inputFile,
        outdir
      });

      // Compatibility wrapper for users who enter a sample directory directly.
      let sampleRunSh = `#!/usr/bin/env bash\n`;
      sampleRunSh += `set -euo pipefail\n`;
      sampleRunSh += `cd "$(dirname "$0")/.."\n`;
      sampleRunSh += `mode="\${1:-start}"\n`;
      sampleRunSh += `case "$mode" in\n`;
      sampleRunSh += `  resume) exec python3 pipeline_runner.py --resume "${safeSampleName}" ;;\n`;
      sampleRunSh += `  restart) exec python3 pipeline_runner.py --restart "${safeSampleName}" ;;\n`;
      sampleRunSh += `  start|run|"") exec python3 pipeline_runner.py --start "${safeSampleName}" ;;\n`;
      sampleRunSh += `  *) echo "Usage: bash run.sh [start|resume|restart]" >&2; exit 2 ;;\n`;
      sampleRunSh += `esac\n`;
      folder.file('run.sh', sampleRunSh, { unixPermissions: '755' });
    }

    const fallbackRunnerReadme = `# Exported Pipeline Runner\n\nRun \`python3 -m pip install -r requirements.txt\` once, then launch \`./run_all.sh\` or \`python3 pipeline_runner.py\`.\n\nUse \`python3 pipeline_runner.py --status\` any time to inspect sample state after the TUI is closed.\n`;
    const runnerScript = await loadTextAsset('./pipeline_runner.py');
    if (!runnerScript) {
      alert("Could not load pipeline_runner.py. Make sure the GitHub Pages site includes pipeline_runner.py next to index.html.");
      return;
    }

    const requirementsContent = await loadTextAsset('./requirements.txt', 'textual>=0.80.0\n');
    const runnerReadme = await loadTextAsset('./RUNNER_README.md', fallbackRunnerReadme);
    const runScriptContent = `#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ "$#" -eq 0 ] && ! python3 -c "import textual" >/dev/null 2>&1; then
  echo "Textual is required for the interactive runner."
  echo "Install it once with:"
  echo "  python3 -m pip install -r requirements.txt"
  echo ""
  echo "Non-interactive status is still available with:"
  echo "  python3 pipeline_runner.py --status"
  echo ""
fi

exec python3 pipeline_runner.py "$@"
`;

    zip.file("runner_manifest.json", JSON.stringify(runnerManifest, null, 2));
    zip.file("pipeline_runner.py", runnerScript, { unixPermissions: '755' });
    zip.file("requirements.txt", requirementsContent);
    zip.file("RUNNER_README.md", runnerReadme);
    zip.file("run_all.sh", runScriptContent, { unixPermissions: '755' });

    const blob = await zip.generateAsync({ type: 'blob', platform: 'UNIX' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pipeline_run_${analysisName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Metro Map Layout Data ---
  const X_SPACING = 160;
  const Y_SPACING = 40;
  const TOP_MARGIN = 180;
  const BOTTOM_MARGIN = 60;
  const LEFT_MARGIN = 130;
  
  const numSamples = samples.length;
  const numCols = sortedSchema.length;

  const svgWidth = LEFT_MARGIN + numCols * X_SPACING + 100;
  const svgHeight = TOP_MARGIN + Math.max(0, numSamples - 1) * Y_SPACING + BOTTOM_MARGIN;
  const centerY = TOP_MARGIN + (Math.max(0, numSamples - 1) * Y_SPACING) / 2;

  const sampleColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'];

  const pathsData = samples.map(() => []);
  sortedSchema.forEach((field, colIdx) => {
    const x = LEFT_MARGIN + colIdx * X_SPACING;
    const isForced = !!forcedColumns[field.key];
    
    samples.forEach((_, sIdx) => {
       const y = isForced ? centerY : TOP_MARGIN + sIdx * Y_SPACING;
       pathsData[sIdx].push({x, y});
    });
  });

  const generatePathDef = (points, startY) => {
    if (points.length === 0) return "";
    let d = `M 10 ${startY} L ${LEFT_MARGIN - 20} ${startY} `; 
    let prevX = LEFT_MARGIN - 20;
    let prevY = startY;

    for (let i = 0; i < points.length; i++) {
      const nextX = points[i].x;
      const nextY = points[i].y;
      const cpX = prevX + (nextX - prevX) * 0.5;
      d += `C ${cpX} ${prevY}, ${cpX} ${nextY}, ${nextX} ${nextY} `;
      prevX = nextX;
      prevY = nextY;
    }
    
    d += ` L ${prevX + X_SPACING} ${prevY}`; 
    return d;
  };

  const formatNodeValue = (val) => {
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (val === '' || val === null || val === undefined) return 'Empty';
    const str = String(val);
    return str.length > 12 ? str.substring(0, 10) + '...' : str;
  };

  const textShadowStyle = { textShadow: '1px 1px 2px #0f172a, -1px -1px 2px #0f172a, 1px -1px 2px #0f172a, -1px 1px 2px #0f172a' };

  // --- Render Helpers ---
  const renderInput = (sample, field) => {
    // Safely ensure input val is never technically undefined to prevent React controlled component warnings
    const rawVal = sample.params[field.key];
    const val = rawVal !== undefined ? rawVal : field.default; 
    
    const isForced = forcedColumns[field.key];
    const baseClasses = `w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${isForced ? 'bg-orange-50/50 border-orange-300' : 'bg-white'}`;

    if (field.type === 'boolean') {
      return (
        <label className="flex items-center space-x-2 cursor-pointer justify-center w-full">
          <div className={`relative w-10 h-5 transition duration-200 ease-linear rounded-full ${val ? 'bg-blue-500' : 'bg-gray-300'} ${isForced ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}>
             <span className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out ${val ? 'transform translate-x-5' : ''}`} />
          </div>
          <input
            type="checkbox"
            className="hidden"
            checked={Boolean(val)}
            onChange={(e) => updateParam(sample.id, field.key, e.target.checked)}
          />
        </label>
      );
    }
    
    if (field.type === 'select') {
      return (
        <select
          value={val ?? ''}
          onChange={(e) => updateParam(sample.id, field.key, e.target.value)}
          className={`${baseClasses} p-1.5`}
        >
          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }

    return (
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={val ?? ''}
        onChange={(e) => updateParam(sample.id, field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
        className={`${baseClasses} p-1.5`}
        placeholder={field.placeholder || ''}
        maxLength={field.maxLength}
        min={field.min}
        max={field.max}
        step={field.step}
      />
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800 flex flex-col">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-white p-6 rounded-xl shadow-sm border border-slate-100 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileType className="text-blue-600" />
            Pipeline Sample Configurator
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Configure pipeline parameters per sample. Force sync a column to share parameters across all samples.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button 
            onClick={addSample}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus size={18} /> Add Sample
          </button>

          <label className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer shadow-sm">
            <Upload size={18} /> Load Session
            <input type="file" accept=".json" className="hidden" onChange={loadSession} />
          </label>

          <label className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer shadow-sm">
            <FolderOpen size={18} /> Load Directory
            <input type="file" webkitdirectory="true" className="hidden" onChange={handleDirectoryUpload} />
          </label>

          <button 
            onClick={saveSession}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Save size={18} /> Save Session
          </button>
          
          <button 
            onClick={exportZip}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <FolderOpen size={18} /> Export Run (ZIP)
          </button>
        </div>
      </div>

      {/* Target Repo Banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Github size={24} className="text-indigo-600" />
          <div>
            <h3 className="font-semibold text-indigo-900 text-sm">Target Repository</h3>
            <p className="text-indigo-700 text-xs font-mono mt-0.5">https://github.com/pinellolab/CRISPR_Pipeline.git</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-indigo-800">Branch:</label>
            <input 
              type="text" 
              value={repoBranch} 
              onChange={e => setRepoBranch(e.target.value)} 
              className="text-xs border border-indigo-300 rounded px-2 py-1.5 bg-white text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-24 shadow-sm"
              placeholder="e.g. main, dev"
            />
          </div>
          <span className="text-xs text-indigo-600 bg-indigo-100 px-3 py-1.5 rounded-full font-medium border border-indigo-200 shadow-sm hidden md:inline-block">
            Cloned automatically on run
          </span>
        </div>
      </div>

      {/* Global Run Settings */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col gap-6">
        
        {/* Row 1: Directories & Files */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <FolderOpen size={16} className="text-blue-500" />
              Base Output Directory
            </label>
            <input 
              type="text" 
              value={baseOutputDir} 
              onChange={e => setBaseOutputDir(e.target.value)} 
              className="w-full border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="gs://..."
            />
            <p className="text-[10px] text-slate-400 mt-1 truncate" title={`${baseOutputDir.endsWith('/') ? baseOutputDir : `${baseOutputDir}/`}${analysisName}/{Sample_Name}`}>
              Preview: {baseOutputDir.endsWith('/') ? baseOutputDir : `${baseOutputDir}/`}{analysisName}/<span className="italic text-slate-500">{samples.length > 0 ? samples[0].name.replace(/\s+/g, '_') : 'Sample_Name'}</span>
            </p>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <FileType size={16} className="text-blue-500" />
              Analysis Name
            </label>
            <input 
              type="text" 
              value={analysisName} 
              onChange={e => setAnalysisName(e.target.value)} 
              className="w-full border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="e.g., low_moi_merge"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Terminal size={16} className="text-blue-500" />
              Base Config File (.config) <span className="text-red-500 ml-1" title="Required">*</span>
            </label>
            <div className="relative">
              <input 
                type="file" 
                accept=".config, .txt, .nf"
                onChange={handleMainNfUpload}
                className="hidden"
                id="main-nf-upload"
              />
              <label 
                htmlFor="main-nf-upload"
                className={`flex items-center justify-between w-full border rounded-md shadow-sm px-3 py-2 text-sm cursor-pointer transition-all ${mainNfContent ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'}`}
              >
                <span className="truncate max-w-[150px] font-medium">{mainNfFileName || 'Upload base config (Required)'}</span>
                {mainNfContent ? <Check size={16} className="text-emerald-500" /> : <Upload size={14} className="text-rose-500" />}
              </label>
            </div>
          </div>
        </div>

        {/* Row 2: Credentials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Shield size={16} className="text-amber-500" />
              Tower Access Token
            </label>
            <input 
              type="password" 
              value={towerToken} 
              onChange={e => setTowerToken(e.target.value)} 
              className="w-full border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
              placeholder="eyJ0..."
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <KeyRound size={16} className="text-amber-500" />
              Google Credentials Path
            </label>
            <input 
              type="text" 
              value={googleCreds} 
              onChange={e => setGoogleCreds(e.target.value)} 
              className="w-full border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
              placeholder="./pipeline-service-key.json"
            />
          </div>
        </div>
        
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col mb-6">
        <div className="overflow-x-auto flex-1 h-[500px]">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
              <tr>
                {/* Fixed first column header */}
                <th className="sticky left-0 bg-slate-100 z-30 p-3 border-b border-r border-slate-200 w-64 min-w-[250px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                  <div className="font-semibold text-slate-700 mb-1">Sample Details</div>
                  <div className="text-xs text-slate-500 font-normal">Name & File Attachment</div>
                </th>

                {/* Parameter Headers */}
                {sortedSchema.map((field) => {
                  const isForced = forcedColumns[field.key];
                  return (
                    <th 
                      key={field.key} 
                      className={`p-3 border-b border-slate-200 min-w-[180px] align-bottom transition-colors duration-300 ${isForced ? 'bg-orange-100 border-orange-200' : ''}`}
                    >
                      <div className="flex flex-col gap-2 h-full justify-end">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-sm font-medium break-words whitespace-normal leading-tight ${field.priority ? 'text-indigo-700' : 'text-slate-700'} ${isForced ? 'text-orange-900' : ''}`}>
                            {field.key}
                            {field.priority && <span className="ml-1 inline-block px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] uppercase font-bold tracking-wider align-middle">Priority</span>}
                          </span>
                          
                          <button
                            onClick={() => toggleForceColumn(field.key)}
                            className={`p-1.5 rounded-md transition-all flex-shrink-0 ${isForced ? 'bg-orange-500 text-white shadow-inner hover:bg-orange-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                            title={isForced ? "Unlock column" : "Force same across all samples"}
                          >
                            {isForced ? <Link size={14} /> : <Link2Off size={14} />}
                          </button>
                        </div>
                      </div>
                    </th>
                  );
                })}
                <th className="p-3 border-b border-slate-200 w-16 sticky right-0 bg-slate-50 shadow-[-2px_0_5px_rgba(0,0,0,0.05)] z-20"></th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100">
              {samples.map((sample, index) => (
                <tr key={sample.id} className="hover:bg-slate-50/50 group">
                  
                  {/* Fixed First Column (Sample Name & File) */}
                  <td className="sticky left-0 bg-white group-hover:bg-slate-50 z-10 p-3 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.02)] align-top">
                    <div className="flex flex-col gap-3">
                      <input
                        type="text"
                        value={sample.name}
                        onChange={(e) => updateSampleName(sample.id, e.target.value)}
                        className="w-full font-medium text-slate-800 bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none focus:ring-0 px-1 py-0.5 transition-colors"
                        placeholder="Sample Name"
                      />
                      
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-1">Attachments</span>
                        
                        {/* Data File Upload */}
                        <div className="flex items-center gap-2">
                           <input 
                              type="file" 
                              className="hidden" 
                              id={`file-${sample.id}`}
                              onChange={(e) => handleFileUpload(sample.id, e)}
                           />
                           <label 
                              htmlFor={`file-${sample.id}`}
                              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer transition-colors border w-full ${sample.fileName ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                           >
                              {sample.fileName ? <Check size={12} /> : <Upload size={12} />}
                              <span className="truncate max-w-[120px]">{sample.fileName || 'Data File'}</span>
                           </label>
                           {sample.fileName && (
                              <button 
                                onClick={() => setSamples(samples.map(s => s.id === sample.id ? {...s, file: null, fileName: ''} : s))}
                                className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                                title="Remove data file"
                              >
                                <Trash2 size={12} />
                              </button>
                           )}
                        </div>

                        {/* Config File Upload */}
                        <div className="flex items-center gap-2">
                           <input 
                              type="file" 
                              accept=".config,.txt,.nf"
                              className="hidden" 
                              id={`config-${sample.id}`}
                              onChange={(e) => handleSampleConfigUpload(sample.id, e)}
                           />
                           <label 
                              htmlFor={`config-${sample.id}`}
                              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer transition-colors border w-full ${sample.sampleConfigFileName ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                           >
                              {sample.sampleConfigFileName ? <Check size={12} /> : <FileType size={12} />}
                              <span className="truncate max-w-[120px]">{sample.sampleConfigFileName || 'Custom Config'}</span>
                           </label>
                           {sample.sampleConfigFileName && (
                              <button 
                                onClick={() => setSamples(samples.map(s => s.id === sample.id ? {...s, sampleConfigFileName: '', sampleConfigContent: ''} : s))}
                                className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                                title="Remove custom config file"
                              >
                                <Trash2 size={12} />
                              </button>
                           )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Parameter Cells */}
                  {sortedSchema.map(field => {
                     const isForced = forcedColumns[field.key];
                     return (
                        <td key={field.key} className={`p-3 align-middle ${isForced ? 'bg-orange-50/30' : ''}`}>
                          <div className="flex items-center justify-center">
                            {renderInput(sample, field)}
                          </div>
                        </td>
                     );
                  })}
                  
                  {/* Delete Row Action */}
                  <td className="p-3 align-middle sticky right-0 bg-white group-hover:bg-slate-50 shadow-[-2px_0_5px_rgba(0,0,0,0.02)] z-10 text-center border-l border-slate-100">
                    <button
                      onClick={() => removeSample(sample.id)}
                      disabled={samples.length === 1}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metro Style Visualization Container */}
      <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-700 p-6 text-white overflow-hidden flex flex-col relative">
        <div className="flex items-center gap-2 mb-2">
          <AlignLeft className="text-blue-400" />
          <h2 className="text-xl font-semibold">Metro Configuration Map</h2>
          <div className="group relative ml-2 cursor-help text-slate-400">
             <Info size={16} />
             <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-72 bg-slate-800 text-xs text-slate-200 p-3 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none border border-slate-700">
               This map visualizes parameters across all samples.<br/><br/>
               <span className="text-orange-400 font-bold">Orange nodes:</span> Parameters forced to sync, merging all paths.<br/>
               <span className="text-blue-400 font-bold">Small nodes:</span> Unforced parameters maintaining separate paths, showing values per sample.
             </div>
          </div>
        </div>
        
        <div className="relative w-full overflow-x-auto overflow-y-hidden custom-scrollbar">
          <svg id="metro-map-svg" width={svgWidth} height={svgHeight} className="min-w-full block" style={{ backgroundColor: '#0f172a' }}>
             {/* Explicit background rectangle for reliable SVG export */}
             <rect width="100%" height="100%" fill="#0f172a" />
             
             {/* Draw Paths */}
             {samples.map((sample, sIdx) => {
                const startY = TOP_MARGIN + sIdx * Y_SPACING;
                return (
                  <path
                    key={`path-${sample.id}`}
                    d={generatePathDef(pathsData[sIdx], startY)}
                    fill="none"
                    stroke={sampleColors[sIdx % sampleColors.length]}
                    strokeWidth="4"
                    strokeOpacity="0.6"
                  />
                );
             })}

             {/* Draw Left Labels */}
             {samples.map((sample, sIdx) => {
                const startY = TOP_MARGIN + sIdx * Y_SPACING;
                return (
                  <text
                    key={`label-${sample.id}`}
                    x={LEFT_MARGIN - 25}
                    y={startY + 4}
                    fill={sampleColors[sIdx % sampleColors.length]}
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="end"
                  >
                    {sample.name}
                  </text>
                );
             })}

             {/* Draw Nodes and Text */}
             {sortedSchema.map((field, colIdx) => {
                const x = LEFT_MARGIN + colIdx * X_SPACING;
                const isForced = !!forcedColumns[field.key];
                const firstVal = samples[0]?.params[field.key];

                return (
                  <g key={`col-${field.key}`}>
                    <text
                      x={x}
                      y={TOP_MARGIN - 25}
                      fill="#94a3b8"
                      fontSize="11"
                      fontWeight="500"
                      transform={`rotate(-40, ${x}, ${TOP_MARGIN - 25})`}
                      textAnchor="start"
                      style={textShadowStyle}
                    >
                      {field.key}
                      <title>{field.key}</title>
                    </text>

                    {isForced ? (
                      <g>
                        <circle cx={x} cy={centerY} r="8" fill="#f97316" stroke="#0f172a" strokeWidth="3" />
                        <text x={x} y={centerY + 24} fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle" style={textShadowStyle}>
                          {formatNodeValue(firstVal)}
                          <title>{String(firstVal)}</title>
                        </text>
                      </g>
                    ) : (
                      samples.map((sample, sIdx) => {
                        const y = TOP_MARGIN + sIdx * Y_SPACING;
                        const val = sample.params[field.key];
                        return (
                          <g key={`div-${field.key}-${sample.id}`}>
                            <circle cx={x} cy={y} r="5" fill={sampleColors[sIdx % sampleColors.length]} stroke="#0f172a" strokeWidth="2" />
                            <text x={x + 10} y={y + 3} fill="#cbd5e1" fontSize="10" style={textShadowStyle}>
                              {formatNodeValue(val)}
                              <title>{String(val)}</title>
                            </text>
                          </g>
                        );
                      })
                    )}
                  </g>
                );
             })}
          </svg>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.5); 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3); 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5); 
        }
      `}} />

    </div>
  );
}
