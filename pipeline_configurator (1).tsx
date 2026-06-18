import React, { useState, useMemo, useRef } from 'react';
import { Download, Plus, Trash2, Upload, Link, Link2Off, FileType, Check, AlignLeft, Info, Terminal, FolderOpen, Save, Github, KeyRound, Shield, SlidersHorizontal, RotateCcw } from 'lucide-react';

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
  
  { key: 'GUIDE_ASSIGNMENT_capture_method', type: 'select', options: ['crop-seq', 'direct-capture'], default: 'crop-seq' },
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

const defaultResourceSettings = {
  singularity_pullTimeout: '',
  max_cpus: 32,
  max_memory_gb: 256,
  default_cpus_start: 16,
  default_memory_gb: 50,
  default_maxRetries: '',
  default_errorStrategy: 'inherit',
  anndata_cpus: '',
  anndata_memory_gb: '',
  anndata_errorStrategy: 'inherit',
  mapping_cpus_start: 30,
  mapping_memory_gb: 100,
  mapping_maxRetries: '',
  mapping_errorStrategy: 'inherit',
  cleanser_scratch: true,
  cleanser_disk: '500 GB',
  sceptre_cpus_start: 16,
  sceptre_memory_gb: 200,
  sceptre_maxRetries: '',
  sceptre_errorStrategy: 'inherit',
  sceptre_chunk_cpus: 8,
  sceptre_chunk_memory_gb: 100,
  perturbo_cpus: 8,
  perturbo_memory_gb: 100,
  perturbo_errorStrategy: 'inherit',
  perturbo_queue: '',
  perturbo_trans_cpus: 8,
  perturbo_trans_memory_gb: 100,
  perturbo_trans_errorStrategy: 'inherit',
  perturbo_trans_queue: ''
};

const devBranchResourceBaseline = { ...defaultResourceSettings };

const resourceFieldGroups = [
  {
    title: 'Global Limits',
    fields: [
      { key: 'singularity_pullTimeout', label: 'Singularity pullTimeout', type: 'text', placeholder: '60m' },
      { key: 'max_cpus', label: 'max_cpus', type: 'number', min: 1 },
      { key: 'max_memory_gb', label: 'max_memory', type: 'number', min: 1, suffix: 'GB' }
    ]
  },
  {
    title: 'Default Process',
    fields: [
      { key: 'default_cpus_start', label: 'Starting CPUs', type: 'number', min: 1 },
      { key: 'default_memory_gb', label: 'Memory per attempt', type: 'number', min: 1, suffix: 'GB' },
      { key: 'default_maxRetries', label: 'Max retries', type: 'number', min: 0 },
      { key: 'default_errorStrategy', label: 'Error strategy', type: 'select', options: ['inherit', 'retry', 'terminate'] }
    ]
  },
  {
    title: 'MuData And AnnData Heavy Steps',
    fields: [
      { key: 'anndata_cpus', label: 'CPUs', type: 'number', min: 1 },
      { key: 'anndata_memory_gb', label: 'Memory', type: 'number', min: 1, suffix: 'GB' },
      { key: 'anndata_errorStrategy', label: 'Error strategy', type: 'select', options: ['inherit', 'retry', 'terminate'] }
    ]
  },
  {
    title: 'Mapping Steps',
    fields: [
      { key: 'mapping_cpus_start', label: 'Starting CPUs', type: 'number', min: 1 },
      { key: 'mapping_memory_gb', label: 'Memory per attempt', type: 'number', min: 1, suffix: 'GB' },
      { key: 'mapping_maxRetries', label: 'Max retries', type: 'number', min: 0 },
      { key: 'mapping_errorStrategy', label: 'Error strategy', type: 'select', options: ['inherit', 'retry', 'terminate'] }
    ]
  },
  {
    title: 'Guide Assignment',
    fields: [
      { key: 'cleanser_scratch', label: 'CLEANSER scratch', type: 'boolean' },
      { key: 'cleanser_disk', label: 'CLEANSER disk', type: 'text', placeholder: '500 GB' },
      { key: 'sceptre_cpus_start', label: 'SCEPTRE starting CPUs', type: 'number', min: 1 },
      { key: 'sceptre_memory_gb', label: 'SCEPTRE memory per attempt', type: 'number', min: 1, suffix: 'GB' },
      { key: 'sceptre_maxRetries', label: 'SCEPTRE max retries', type: 'number', min: 0 },
      { key: 'sceptre_errorStrategy', label: 'SCEPTRE error strategy', type: 'select', options: ['inherit', 'retry', 'terminate'] }
    ]
  },
  {
    title: 'SCEPTRE Chunking',
    fields: [
      { key: 'sceptre_chunk_cpus', label: 'CPUs', type: 'number', min: 1 },
      { key: 'sceptre_chunk_memory_gb', label: 'Memory', type: 'number', min: 1, suffix: 'GB' }
    ]
  },
  {
    title: 'PerTurbo GPU Steps',
    fields: [
      { key: 'perturbo_cpus', label: 'PerTurbo CPUs', type: 'number', min: 1 },
      { key: 'perturbo_memory_gb', label: 'PerTurbo memory', type: 'number', min: 1, suffix: 'GB' },
      { key: 'perturbo_errorStrategy', label: 'PerTurbo error strategy', type: 'select', options: ['inherit', 'retry', 'terminate'] },
      { key: 'perturbo_queue', label: 'PerTurbo GPU queue', type: 'text', placeholder: 'gpu' },
      { key: 'perturbo_trans_cpus', label: 'PerTurbo trans CPUs', type: 'number', min: 1 },
      { key: 'perturbo_trans_memory_gb', label: 'PerTurbo trans memory', type: 'number', min: 1, suffix: 'GB' },
      { key: 'perturbo_trans_errorStrategy', label: 'PerTurbo trans error strategy', type: 'select', options: ['inherit', 'retry', 'terminate'] },
      { key: 'perturbo_trans_queue', label: 'PerTurbo trans GPU queue', type: 'text', placeholder: 'gpu' }
    ]
  }
];

const resourceFields = resourceFieldGroups.reduce((fields, group) => fields.concat(group.fields), []);
const resourceFieldKeys = new Set(resourceFields.map(field => field.key));
const RESOURCE_PROFILE_KEY = '__resource_profile';
const DEFAULT_RESOURCE_PROFILE_KEY = 'default-from-config';
const RESOURCE_PROFILE_STORAGE_KEY = 'crispr_resource_profiles';
const RESOURCE_PROFILE_DB_STORAGE_KEY = 'crispr_resource_profile_db';
const DEFAULT_SUPABASE_URL = 'https://sibzwlumosfvdidyzngu.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_DG9PRfZZBR0vXJqXqCnk-g_pGudaLIZ';
const RESOURCE_PROFILE_TABLE = 'resource_profiles';

const resourceProfiles = [
  {
    key: 'small-local',
    label: 'Small local datasets (< 100k cells)',
    values: {
      singularity_pullTimeout: '30m',
      max_cpus: 4,
      max_memory_gb: 64,
      default_cpus_start: 2,
      default_memory_gb: 16,
      default_maxRetries: 2,
      default_errorStrategy: 'retry',
      anndata_cpus: 4,
      anndata_memory_gb: 64,
      anndata_errorStrategy: 'terminate',
      mapping_cpus_start: 4,
      mapping_memory_gb: 64,
      mapping_maxRetries: 2,
      mapping_errorStrategy: 'retry',
      cleanser_scratch: true,
      cleanser_disk: '100 GB',
      sceptre_cpus_start: 4,
      sceptre_memory_gb: 64,
      sceptre_maxRetries: 2,
      sceptre_errorStrategy: 'retry',
      sceptre_chunk_cpus: 4,
      sceptre_chunk_memory_gb: 32,
      perturbo_cpus: 4,
      perturbo_memory_gb: 64,
      perturbo_errorStrategy: 'terminate',
      perturbo_queue: 'gpu',
      perturbo_trans_cpus: 4,
      perturbo_trans_memory_gb: 64,
      perturbo_trans_errorStrategy: 'terminate',
      perturbo_trans_queue: 'gpu'
    }
  },
  {
    key: 'standard',
    label: 'Standard datasets (100k-500k cells)',
    values: {
      singularity_pullTimeout: '45m',
      max_cpus: 8,
      max_memory_gb: 128,
      default_cpus_start: 4,
      default_memory_gb: 50,
      default_maxRetries: 3,
      default_errorStrategy: 'retry',
      anndata_cpus: 8,
      anndata_memory_gb: 128,
      anndata_errorStrategy: 'terminate',
      mapping_cpus_start: 8,
      mapping_memory_gb: 100,
      mapping_maxRetries: 3,
      mapping_errorStrategy: 'retry',
      cleanser_scratch: true,
      cleanser_disk: '250 GB',
      sceptre_cpus_start: 6,
      sceptre_memory_gb: 100,
      sceptre_maxRetries: 3,
      sceptre_errorStrategy: 'retry',
      sceptre_chunk_cpus: 6,
      sceptre_chunk_memory_gb: 64,
      perturbo_cpus: 8,
      perturbo_memory_gb: 128,
      perturbo_errorStrategy: 'terminate',
      perturbo_queue: 'gpu',
      perturbo_trans_cpus: 8,
      perturbo_trans_memory_gb: 96,
      perturbo_trans_errorStrategy: 'terminate',
      perturbo_trans_queue: 'gpu'
    }
  },
  {
    key: 'expanded',
    label: 'Expanded datasets (500k-1M cells)',
    values: {
      singularity_pullTimeout: '60m',
      max_cpus: 12,
      max_memory_gb: 256,
      default_cpus_start: 4,
      default_memory_gb: 100,
      default_maxRetries: 3,
      default_errorStrategy: 'retry',
      anndata_cpus: 12,
      anndata_memory_gb: 256,
      anndata_errorStrategy: 'terminate',
      mapping_cpus_start: 12,
      mapping_memory_gb: 150,
      mapping_maxRetries: 3,
      mapping_errorStrategy: 'retry',
      cleanser_scratch: true,
      cleanser_disk: '350 GB',
      sceptre_cpus_start: 6,
      sceptre_memory_gb: 150,
      sceptre_maxRetries: 3,
      sceptre_errorStrategy: 'retry',
      sceptre_chunk_cpus: 8,
      sceptre_chunk_memory_gb: 100,
      perturbo_cpus: 10,
      perturbo_memory_gb: 180,
      perturbo_errorStrategy: 'terminate',
      perturbo_queue: 'gpu',
      perturbo_trans_cpus: 10,
      perturbo_trans_memory_gb: 105,
      perturbo_trans_errorStrategy: 'terminate',
      perturbo_trans_queue: 'gpu'
    }
  },
  {
    key: 'high-memory',
    label: 'High memory datasets',
    values: {
      singularity_pullTimeout: '60m',
      max_cpus: 16,
      max_memory_gb: 400,
      default_cpus_start: 4,
      default_memory_gb: 150,
      default_maxRetries: 3,
      default_errorStrategy: 'retry',
      anndata_cpus: 12,
      anndata_memory_gb: 400,
      anndata_errorStrategy: 'terminate',
      mapping_cpus_start: 12,
      mapping_memory_gb: 200,
      mapping_maxRetries: 3,
      mapping_errorStrategy: 'retry',
      cleanser_scratch: true,
      cleanser_disk: '500 GB',
      sceptre_cpus_start: 8,
      sceptre_memory_gb: 200,
      sceptre_maxRetries: 3,
      sceptre_errorStrategy: 'retry',
      sceptre_chunk_cpus: 8,
      sceptre_chunk_memory_gb: 100,
      perturbo_cpus: 12,
      perturbo_memory_gb: 200,
      perturbo_errorStrategy: 'terminate',
      perturbo_queue: 'gpu',
      perturbo_trans_cpus: 10,
      perturbo_trans_memory_gb: 105,
      perturbo_trans_errorStrategy: 'terminate',
      perturbo_trans_queue: 'gpu'
    }
  },
  {
    key: 'large-scale',
    label: 'Large scale datasets (> 1M cells and 20k guides)',
    values: {
      singularity_pullTimeout: '60m',
      max_cpus: 12,
      max_memory_gb: 600,
      default_cpus_start: 4,
      default_memory_gb: 200,
      default_maxRetries: 3,
      default_errorStrategy: 'retry',
      anndata_cpus: 12,
      anndata_memory_gb: 600,
      anndata_errorStrategy: 'terminate',
      mapping_cpus_start: 12,
      mapping_memory_gb: 200,
      mapping_maxRetries: 3,
      mapping_errorStrategy: 'retry',
      cleanser_scratch: true,
      cleanser_disk: '500 GB',
      sceptre_cpus_start: 6,
      sceptre_memory_gb: 200,
      sceptre_maxRetries: 3,
      sceptre_errorStrategy: 'retry',
      sceptre_chunk_cpus: 8,
      sceptre_chunk_memory_gb: 100,
      perturbo_cpus: 12,
      perturbo_memory_gb: 200,
      perturbo_errorStrategy: 'terminate',
      perturbo_queue: 'gpu',
      perturbo_trans_cpus: 10,
      perturbo_trans_memory_gb: 105,
      perturbo_trans_errorStrategy: 'terminate',
      perturbo_trans_queue: 'gpu'
    }
  }
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

const generateDefaultResourceSettings = () => ({ ...defaultResourceSettings });

const createDefaultResourceState = () => {
  const defaults = generateDefaultResourceSettings();
  return {
    resourceSettings: { ...defaults },
    resourceDefaults: { ...defaults },
    resourceProfile: ''
  };
};

const createId = () => {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `id_${timePart}_${randomPart}`;
};

const hasResourceValue = (value) => value !== undefined && value !== null && value !== '';

const resourceNumber = (value) => {
  if (!hasResourceValue(value)) return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : '';
};

const parseMemoryGb = (rawValue) => {
  if (!rawValue) return '';
  const match = String(rawValue).match(/([0-9]+(?:\.[0-9]+)?)\s*(?:\.?\s*)?(TB|GB|G|MB|M)?/i);
  if (!match) return '';
  const amount = Number(match[1]);
  const unit = (match[2] || 'GB').toUpperCase();
  if (!Number.isFinite(amount)) return '';
  if (unit === 'TB') return amount * 1000;
  if (unit === 'MB' || unit === 'M') return amount / 1000;
  return amount;
};

const parseCpuStart = (rawValue) => {
  if (!rawValue) return '';
  const match = String(rawValue).match(/Math\.min\(\s*([0-9]+(?:\.[0-9]+)?)/);
  if (match) return resourceNumber(match[1]);
  const direct = String(rawValue).match(/([0-9]+(?:\.[0-9]+)?)/);
  return direct ? resourceNumber(direct[1]) : '';
};

const parseRetries = (rawValue) => {
  if (!rawValue) return '';
  const match = String(rawValue).match(/([0-9]+)/);
  return match ? resourceNumber(match[1]) : '';
};

const parseBooleanValue = (rawValue) => {
  if (!rawValue) return '';
  const normalized = String(rawValue).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return '';
};

const parseQuotedValue = (rawValue) => {
  if (!rawValue) return '';
  return String(rawValue).trim().replace(/^['"]/, '').replace(/['"]$/, '');
};

const findAssignment = (content, key) => {
  if (!content) return '';
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`(?:^|\\n)\\s*(?:params\\.)?${escapedKey}\\s*=\\s*([^\\n]+)`));
  return match ? match[1].replace(/\/\/.*$/, '').trim() : '';
};

const extractBalancedBlock = (content, openBraceIndex) => {
  let depth = 0;
  for (let index = openBraceIndex; index < content.length; index += 1) {
    const char = content[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return content.slice(openBraceIndex + 1, index);
      }
    }
  }
  return '';
};

const findNamedBlock = (content, name, fromEnd = false) => {
  if (!content) return '';
  const regex = new RegExp(`${name}\\s*\\{`, 'g');
  let match = null;
  let selected = null;
  while ((match = regex.exec(content)) !== null) {
    selected = match;
    if (!fromEnd) break;
  }
  if (!selected) return '';
  const openBraceIndex = content.indexOf('{', selected.index);
  return extractBalancedBlock(content, openBraceIndex);
};

const findNamedBlocks = (content, name) => {
  if (!content) return [];
  const regex = new RegExp(`${name}\\s*\\{`, 'g');
  const blocks = [];
  let match = null;
  while ((match = regex.exec(content)) !== null) {
    const openBraceIndex = content.indexOf('{', match.index);
    const block = extractBalancedBlock(content, openBraceIndex);
    if (block) blocks.push(block);
  }
  return blocks;
};

const findGlobalProcessBlock = (content) => {
  const blocks = findNamedBlocks(content, 'process');
  return blocks.find(block => block.includes('withName:') || block.includes('publishDir')) || blocks[blocks.length - 1] || '';
};

const findTopLevelNamedBlock = (content, name) => {
  if (!content) return '';
  const regex = new RegExp(`${name}\\s*\\{`, 'g');
  let match = null;
  while ((match = regex.exec(content)) !== null) {
    let depth = 0;
    for (let index = 0; index < match.index; index += 1) {
      if (content[index] === '{') depth += 1;
      if (content[index] === '}') depth -= 1;
    }
    if (depth === 0) {
      const openBraceIndex = content.indexOf('{', match.index);
      return extractBalancedBlock(content, openBraceIndex);
    }
  }
  return '';
};

const findWithNameBlock = (content, selector) => {
  if (!content) return '';
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`withName:\\s*['"]${escapedSelector}['"]\\s*\\{`);
  const match = content.match(regex);
  if (!match) return '';
  const openBraceIndex = content.indexOf('{', match.index);
  return extractBalancedBlock(content, openBraceIndex);
};

const stripWithNameBlocks = (content) => content.replace(/withName:\s*['"][^'"]+['"]\s*\{[\s\S]*?\n\s*\}/g, '');

const detectErrorStrategy = (block) => {
  const raw = findAssignment(block, 'errorStrategy');
  if (!raw) return 'inherit';
  if (raw.includes('retry')) return 'retry';
  if (raw.includes('terminate')) return 'terminate';
  return 'inherit';
};

const parseResourceConfig = (content) => {
  const parsed = generateDefaultResourceSettings();
  if (!content) return parsed;

  const processBlock = findGlobalProcessBlock(content);
  const defaultProcessBlock = stripWithNameBlocks(processBlock);
  const singularityBlock = findTopLevelNamedBlock(content, 'singularity') || findNamedBlock(content, 'singularity', true);
  const mappingBlock = findWithNameBlock(processBlock, 'mappingGuide|mappingHashing|mappingscRNA');
  const cleanserBlock = findWithNameBlock(processBlock, 'guide_assignment_cleanser');
  const sceptreBlock = findWithNameBlock(processBlock, 'guide_assignment_sceptre|inference_sceptre');
  const sceptreChunkBlock = findWithNameBlock(processBlock, 'sceptre_chunk_prepare|sceptre_chunk_merge');
  const perturboCombinedBlock = findWithNameBlock(processBlock, 'inference_perturbo|inference_perturbo_trans');
  const perturboBlock = findWithNameBlock(processBlock, 'inference_perturbo') || perturboCombinedBlock;
  const perturboTransBlock = findWithNameBlock(processBlock, 'inference_perturbo_trans') || perturboCombinedBlock;
  const anndataBlock = findWithNameBlock(processBlock, 'anndata_concat|CreateMuData|mudata_concat|inference_mudata|mergeMudata');

  parsed.max_cpus = resourceNumber(findAssignment(content, 'max_cpus')) || parsed.max_cpus;
  parsed.max_memory_gb = parseMemoryGb(findAssignment(content, 'max_memory')) || parsed.max_memory_gb;
  parsed.singularity_pullTimeout = parseQuotedValue(findAssignment(singularityBlock, 'pullTimeout')) || '';

  parsed.default_cpus_start = parseCpuStart(findAssignment(defaultProcessBlock, 'cpus')) || parsed.default_cpus_start;
  parsed.default_memory_gb = parseMemoryGb(findAssignment(defaultProcessBlock, 'memory')) || parsed.default_memory_gb;
  parsed.default_maxRetries = parseRetries(findAssignment(defaultProcessBlock, 'maxRetries'));
  parsed.default_errorStrategy = detectErrorStrategy(defaultProcessBlock);

  parsed.anndata_cpus = parseCpuStart(findAssignment(anndataBlock, 'cpus'));
  parsed.anndata_memory_gb = parseMemoryGb(findAssignment(anndataBlock, 'memory'));
  parsed.anndata_errorStrategy = detectErrorStrategy(anndataBlock);

  parsed.mapping_cpus_start = parseCpuStart(findAssignment(mappingBlock, 'cpus')) || parsed.mapping_cpus_start;
  parsed.mapping_memory_gb = parseMemoryGb(findAssignment(mappingBlock, 'memory')) || parsed.mapping_memory_gb;
  parsed.mapping_maxRetries = parseRetries(findAssignment(mappingBlock, 'maxRetries'));
  parsed.mapping_errorStrategy = detectErrorStrategy(mappingBlock);

  const parsedScratch = parseBooleanValue(findAssignment(cleanserBlock, 'scratch'));
  parsed.cleanser_scratch = parsedScratch === '' ? parsed.cleanser_scratch : parsedScratch;
  parsed.cleanser_disk = parseQuotedValue(findAssignment(cleanserBlock, 'disk')) || parsed.cleanser_disk;

  parsed.sceptre_cpus_start = parseCpuStart(findAssignment(sceptreBlock, 'cpus')) || parsed.sceptre_cpus_start;
  parsed.sceptre_memory_gb = parseMemoryGb(findAssignment(sceptreBlock, 'memory')) || parsed.sceptre_memory_gb;
  parsed.sceptre_maxRetries = parseRetries(findAssignment(sceptreBlock, 'maxRetries'));
  parsed.sceptre_errorStrategy = detectErrorStrategy(sceptreBlock);

  parsed.sceptre_chunk_cpus = parseCpuStart(findAssignment(sceptreChunkBlock, 'cpus')) || parsed.sceptre_chunk_cpus;
  parsed.sceptre_chunk_memory_gb = parseMemoryGb(findAssignment(sceptreChunkBlock, 'memory')) || parsed.sceptre_chunk_memory_gb;

  parsed.perturbo_cpus = parseCpuStart(findAssignment(perturboBlock, 'cpus')) || parsed.perturbo_cpus;
  parsed.perturbo_memory_gb = parseMemoryGb(findAssignment(perturboBlock, 'memory')) || parsed.perturbo_memory_gb;
  parsed.perturbo_errorStrategy = detectErrorStrategy(perturboBlock);
  parsed.perturbo_queue = parseQuotedValue(findAssignment(perturboBlock, 'queue')) || '';

  parsed.perturbo_trans_cpus = parseCpuStart(findAssignment(perturboTransBlock, 'cpus')) || parsed.perturbo_trans_cpus;
  parsed.perturbo_trans_memory_gb = parseMemoryGb(findAssignment(perturboTransBlock, 'memory')) || parsed.perturbo_trans_memory_gb;
  parsed.perturbo_trans_errorStrategy = detectErrorStrategy(perturboTransBlock);
  parsed.perturbo_trans_queue = parseQuotedValue(findAssignment(perturboTransBlock, 'queue')) || '';

  return parsed;
};

const quoteConfigValue = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const formatGb = (value) => `${Number(value)}.GB`;

const retryStrategyLine = (retries) => {
  const retryCount = Number(retries);
  return Number.isFinite(retryCount) && retryCount > 0
    ? `errorStrategy = { task.attempt <= ${retryCount} ? 'retry' : 'terminate' }`
    : "errorStrategy = 'terminate'";
};

const appendErrorStrategy = (lines, indent, strategy, retries) => {
  if (strategy === 'terminate') {
    lines.push(`${indent}errorStrategy = 'terminate'`);
  } else if (strategy === 'retry') {
    if (hasResourceValue(retries)) {
      lines.push(`${indent}maxRetries = ${Number(retries)}`);
    }
    lines.push(`${indent}${retryStrategyLine(retries)}`);
  }
};

const buildResourceOverrideConfig = (settings) => {
  const resources = { ...generateDefaultResourceSettings(), ...settings };
  const lines = [
    '',
    '// --- Computational resource overrides injected by Pipeline Configurator ---',
    'params {'
  ];

  if (hasResourceValue(resources.max_cpus)) lines.push(`  max_cpus = ${Number(resources.max_cpus)}`);
  if (hasResourceValue(resources.max_memory_gb)) lines.push(`  max_memory = ${formatGb(resources.max_memory_gb)}`);
  lines.push('}');

  if (hasResourceValue(resources.singularity_pullTimeout)) {
    lines.push('');
    lines.push('singularity {');
    lines.push(`  pullTimeout = ${quoteConfigValue(resources.singularity_pullTimeout)}`);
    lines.push('}');
  }

  lines.push('');
  lines.push('process {');
  if (hasResourceValue(resources.default_cpus_start)) {
    lines.push(`  cpus = { Math.min(${Number(resources.default_cpus_start)} * task.attempt, params.max_cpus) }`);
  }
  if (hasResourceValue(resources.default_memory_gb)) {
    lines.push(`  memory = { [${formatGb(resources.default_memory_gb)} * task.attempt, params.max_memory].min() }`);
  }
  appendErrorStrategy(lines, '  ', resources.default_errorStrategy, resources.default_maxRetries);

  if (hasResourceValue(resources.anndata_cpus) || hasResourceValue(resources.anndata_memory_gb) || resources.anndata_errorStrategy !== 'inherit') {
    lines.push('');
    lines.push("  withName: 'anndata_concat|CreateMuData|mudata_concat|inference_mudata|mergeMudata' {");
    if (hasResourceValue(resources.anndata_cpus)) lines.push(`    cpus = { Math.min(${Number(resources.anndata_cpus)}, params.max_cpus) }`);
    if (hasResourceValue(resources.anndata_memory_gb)) lines.push(`    memory = { [${formatGb(resources.anndata_memory_gb)}, params.max_memory].min() }`);
    appendErrorStrategy(lines, '    ', resources.anndata_errorStrategy, '');
    lines.push('  }');
  }

  lines.push('');
  lines.push("  withName: 'mappingGuide|mappingHashing|mappingscRNA' {");
  if (hasResourceValue(resources.mapping_cpus_start)) lines.push(`    cpus = { Math.min(${Number(resources.mapping_cpus_start)} * task.attempt, params.max_cpus) }`);
  if (hasResourceValue(resources.mapping_memory_gb)) lines.push(`    memory = { [${formatGb(resources.mapping_memory_gb)} * task.attempt, params.max_memory].min() }`);
  appendErrorStrategy(lines, '    ', resources.mapping_errorStrategy, resources.mapping_maxRetries);
  lines.push('  }');

  lines.push('');
  lines.push("  withName: 'guide_assignment_cleanser' {");
  lines.push(`    scratch = ${resources.cleanser_scratch ? 'true' : 'false'}`);
  if (hasResourceValue(resources.cleanser_disk)) lines.push(`    disk = ${quoteConfigValue(resources.cleanser_disk)}`);
  lines.push('  }');

  lines.push('');
  lines.push("  withName: 'guide_assignment_sceptre|inference_sceptre' {");
  if (hasResourceValue(resources.sceptre_cpus_start)) lines.push(`    cpus = { Math.min(${Number(resources.sceptre_cpus_start)} * task.attempt, params.max_cpus) }`);
  if (hasResourceValue(resources.sceptre_memory_gb)) lines.push(`    memory = { [${formatGb(resources.sceptre_memory_gb)} * task.attempt, params.max_memory].min() }`);
  appendErrorStrategy(lines, '    ', resources.sceptre_errorStrategy, resources.sceptre_maxRetries);
  lines.push('  }');

  lines.push('');
  lines.push("  withName: 'sceptre_chunk_prepare|sceptre_chunk_merge' {");
  if (hasResourceValue(resources.sceptre_chunk_cpus)) lines.push(`    cpus = { Math.min(${Number(resources.sceptre_chunk_cpus)}, params.max_cpus) }`);
  if (hasResourceValue(resources.sceptre_chunk_memory_gb)) lines.push(`    memory = { [${formatGb(resources.sceptre_chunk_memory_gb)}, params.max_memory].min() }`);
  lines.push('  }');

  lines.push('');
  lines.push("  withName: 'inference_perturbo' {");
  if (hasResourceValue(resources.perturbo_cpus)) lines.push(`    cpus = { Math.min(${Number(resources.perturbo_cpus)}, params.max_cpus) }`);
  if (hasResourceValue(resources.perturbo_memory_gb)) lines.push(`    memory = { [${formatGb(resources.perturbo_memory_gb)}, params.max_memory].min() }`);
  appendErrorStrategy(lines, '    ', resources.perturbo_errorStrategy, '');
  if (hasResourceValue(resources.perturbo_queue)) lines.push(`    queue = ${quoteConfigValue(resources.perturbo_queue)}`);
  lines.push('  }');

  lines.push('');
  lines.push("  withName: 'inference_perturbo_trans' {");
  if (hasResourceValue(resources.perturbo_trans_cpus)) lines.push(`    cpus = { Math.min(${Number(resources.perturbo_trans_cpus)}, params.max_cpus) }`);
  if (hasResourceValue(resources.perturbo_trans_memory_gb)) lines.push(`    memory = { [${formatGb(resources.perturbo_trans_memory_gb)}, params.max_memory].min() }`);
  appendErrorStrategy(lines, '    ', resources.perturbo_trans_errorStrategy, '');
  if (hasResourceValue(resources.perturbo_trans_queue)) lines.push(`    queue = ${quoteConfigValue(resources.perturbo_trans_queue)}`);
  lines.push('  }');

  lines.push('}');
  return lines.join('\n');
};

const normalizeResourceSettings = (settings) => ({ ...generateDefaultResourceSettings(), ...(settings || {}) });

const resourceSettingsSignature = (settings) => JSON.stringify(normalizeResourceSettings(settings));

const hasResourceConfigContent = (content) => (
  /(?:^|\n)\s*(?:params\.)?max_cpus\s*=/.test(content) ||
  /(?:^|\n)\s*(?:params\.)?max_memory\s*=/.test(content) ||
  /(?:^|\n)\s*singularity\s*\{/.test(content) ||
  /(?:^|\n)\s*process\s*\{/.test(content) ||
  /withName:\s*['"]/.test(content)
);

const withSampleResourceState = (sample, fallbackDefaults) => {
  const defaults = normalizeResourceSettings(sample.resourceDefaults || fallbackDefaults);
  return {
    ...sample,
    resourceDefaults: defaults,
    resourceSettings: normalizeResourceSettings(sample.resourceSettings || defaults),
    resourceProfile: sample.resourceProfile || ''
  };
};

const getStoredJson = (key, fallback) => {
  try {
    if (!globalThis.localStorage) return fallback;
    const raw = globalThis.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
};

const setStoredJson = (key, value) => {
  try {
    if (globalThis.localStorage) {
      globalThis.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    console.warn(`Could not persist ${key}`, error);
  }
};

const normalizeUserProfile = (profile) => ({
  id: profile.id || createId(),
  name: profile.name || 'Untitled profile',
  createdBy: profile.createdBy || profile.created_by || '',
  description: profile.description || '',
  createdAt: profile.createdAt || profile.created_at || new Date().toISOString(),
  values: normalizeResourceSettings(profile.values || {})
});

const toSupabaseProfilePayload = (profile) => ({
  name: profile.name,
  created_by: profile.createdBy || '',
  description: profile.description || '',
  values: normalizeResourceSettings(profile.values || {})
});

const fromSupabaseProfileRow = (row) => normalizeUserProfile({
  id: row.id,
  name: row.name,
  createdBy: row.created_by,
  description: row.description,
  createdAt: row.created_at,
  values: row.values
});

const loadStoredResourceProfiles = () => {
  const stored = getStoredJson(RESOURCE_PROFILE_STORAGE_KEY, []);
  return Array.isArray(stored) ? stored.map(normalizeUserProfile) : [];
};

const defaultResourceDbSettings = {
  supabaseUrl: DEFAULT_SUPABASE_URL,
  publishableKey: DEFAULT_SUPABASE_PUBLISHABLE_KEY
};

const loadStoredResourceDbSettings = () => ({
  ...defaultResourceDbSettings,
  ...getStoredJson(RESOURCE_PROFILE_DB_STORAGE_KEY, {})
});

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
      id: createId(), 
      name: 'Sample 1', 
      file: null, 
      fileName: '', 
      sampleConfigFileName: '', 
      sampleConfigContent: '', 
      params: generateDefaultParams(),
      ...createDefaultResourceState()
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
  const [showResourceSettings, setShowResourceSettings] = useState(false);
  const [configResourceDefaults, setConfigResourceDefaults] = useState(generateDefaultResourceSettings());
  const [userResourceProfiles, setUserResourceProfiles] = useState(loadStoredResourceProfiles);
  const [resourceProfileDb, setResourceProfileDb] = useState(loadStoredResourceDbSettings);
  const [resourceProfileDraft, setResourceProfileDraft] = useState({
    name: '',
    createdBy: '',
    description: '',
    sampleId: ''
  });
  const [resourceDbStatus, setResourceDbStatus] = useState('');
  const [onlineProfileSampleId, setOnlineProfileSampleId] = useState('');

  const activeOnlineProfileSample = samples.find(sample => sample.id === onlineProfileSampleId);

  // --- Handlers ---
  const addSample = () => {
    // If there are forced columns, inherit their values from the first sample
    const newParams = generateDefaultParams();
    const newResourceState = createDefaultResourceState();
    if (samples.length > 0) {
      Object.keys(forcedColumns).forEach(key => {
        if (forcedColumns[key] && resourceFieldKeys.has(key)) {
          newResourceState.resourceSettings[key] = samples[0].resourceSettings?.[key];
        } else if (forcedColumns[key] && key === RESOURCE_PROFILE_KEY) {
          newResourceState.resourceProfile = samples[0].resourceProfile || '';
          newResourceState.resourceSettings = { ...newResourceState.resourceSettings, ...(samples[0].resourceSettings || {}) };
        } else if (forcedColumns[key]) {
          newParams[key] = samples[0].params[key];
        }
      });
    }
    
    setSamples([...samples, { 
      id: createId(), 
      name: `Sample_${samples.length + 1}`, 
      file: null, 
      fileName: '',
      sampleConfigFileName: '',
      sampleConfigContent: '',
      params: newParams,
      ...newResourceState
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
        if (resourceFieldKeys.has(key)) {
          const firstValue = samples[0].resourceSettings?.[key];
          setSamples(currentSamples =>
            currentSamples.map(s => ({
              ...s,
              resourceSettings: { ...generateDefaultResourceSettings(), ...(s.resourceSettings || {}), [key]: firstValue }
            }))
          );
        } else if (key === RESOURCE_PROFILE_KEY) {
          const firstProfile = samples[0].resourceProfile || '';
          const firstResources = { ...generateDefaultResourceSettings(), ...(samples[0].resourceSettings || {}) };
          setSamples(currentSamples =>
            currentSamples.map(s => ({
              ...s,
              resourceProfile: firstProfile,
              resourceSettings: { ...firstResources }
            }))
          );
        } else {
          const firstValue = samples[0].params[key];
          setSamples(currentSamples => 
            currentSamples.map(s => ({ ...s, params: { ...s.params, [key]: firstValue } }))
          );
        }
      }
      return { ...prev, [key]: isForcedNow };
    });
  };

  const updateResourceSetting = (sampleId, key, value) => {
    if (forcedColumns[key]) {
      setSamples(samples.map(s => ({
        ...s,
        resourceSettings: { ...generateDefaultResourceSettings(), ...(s.resourceSettings || {}), [key]: value }
      })));
    } else {
      setSamples(samples.map(s => s.id === sampleId ? {
        ...s,
        resourceSettings: { ...generateDefaultResourceSettings(), ...(s.resourceSettings || {}), [key]: value }
      } : s));
    }
  };

  const resetResourceSettingsToConfigDefaults = (sampleId) => {
    const confirmed = window.confirm(
      "Reset this sample's Computational Resource parameters to the defaults parsed from its config?\n\nCurrent resource edits for this sample will be replaced."
    );
    if (confirmed) {
      const targetSample = samples.find(s => s.id === sampleId);
      const targetDefaults = normalizeResourceSettings(targetSample?.resourceDefaults || configResourceDefaults);
      setSamples(samples.map(s => {
        if (s.id === sampleId) {
          return {
            ...s,
            resourceSettings: targetDefaults,
            resourceProfile: ''
          };
        }
        const syncedSettings = resourceFields.reduce((settings, field) => {
          if (forcedColumns[field.key]) {
            settings[field.key] = targetDefaults[field.key];
          }
          return settings;
        }, { ...generateDefaultResourceSettings(), ...(s.resourceSettings || {}) });
        return {
          ...s,
          resourceSettings: syncedSettings
        };
      }));
    }
  };

  const applyDefaultResourceProfile = (sampleId) => {
    const confirmed = window.confirm(
      `Apply resource profile "Default from config"?\n\nComputational Resource parameters for ${forcedColumns[RESOURCE_PROFILE_KEY] ? 'every synced sample' : 'this sample'} will be restored from parsed config defaults.`
    );
    if (!confirmed) return;

    if (forcedColumns[RESOURCE_PROFILE_KEY]) {
      setSamples(samples.map(s => ({
        ...s,
        resourceProfile: DEFAULT_RESOURCE_PROFILE_KEY,
        resourceSettings: normalizeResourceSettings(s.resourceDefaults || configResourceDefaults)
      })));
      return;
    }

    const targetSample = samples.find(s => s.id === sampleId);
    const targetDefaults = normalizeResourceSettings(targetSample?.resourceDefaults || configResourceDefaults);
    setSamples(samples.map(s => {
      if (s.id === sampleId) {
        return {
          ...s,
          resourceProfile: DEFAULT_RESOURCE_PROFILE_KEY,
          resourceSettings: targetDefaults
        };
      }
      const syncedSettings = resourceFields.reduce((settings, field) => {
        if (forcedColumns[field.key]) {
          settings[field.key] = targetDefaults[field.key];
        }
        return settings;
      }, { ...generateDefaultResourceSettings(), ...(s.resourceSettings || {}) });
      return {
        ...s,
        resourceSettings: syncedSettings
      };
    }));
  };

  const applyResourceProfile = (sampleId, profileKey) => {
    if (!profileKey) return;
    if (profileKey === DEFAULT_RESOURCE_PROFILE_KEY) {
      applyDefaultResourceProfile(sampleId);
      return;
    }
    const userProfile = userResourceProfiles.find(item => item.id === profileKey);
    if (userProfile) {
      const confirmed = window.confirm(
        `Apply user resource profile "${userProfile.name}"?\n\nAll Computational Resource parameters for ${forcedColumns[RESOURCE_PROFILE_KEY] ? 'every synced sample' : 'this sample'} will be transformed into this profile's values.`
      );
      if (!confirmed) return;

      if (forcedColumns[RESOURCE_PROFILE_KEY]) {
        setSamples(samples.map(s => ({
          ...s,
          resourceProfile: userProfile.id,
          resourceSettings: { ...generateDefaultResourceSettings(), ...userProfile.values }
        })));
      } else {
        setSamples(samples.map(s => {
          if (s.id === sampleId) {
            return {
              ...s,
              resourceProfile: userProfile.id,
              resourceSettings: { ...generateDefaultResourceSettings(), ...userProfile.values }
            };
          }
          const syncedSettings = resourceFields.reduce((settings, field) => {
            if (forcedColumns[field.key]) {
              settings[field.key] = userProfile.values[field.key];
            }
            return settings;
          }, { ...generateDefaultResourceSettings(), ...(s.resourceSettings || {}) });
          return {
            ...s,
            resourceSettings: syncedSettings
          };
        }));
      }
      return;
    }

    const profile = resourceProfiles.find(item => item.key === profileKey);
    if (!profile) return;
    const confirmed = window.confirm(
      `Apply resource profile "${profile.label}"?\n\nAll Computational Resource parameters for ${forcedColumns[RESOURCE_PROFILE_KEY] ? 'every synced sample' : 'this sample'} will be transformed into this profile's values.`
    );
    if (confirmed) {
      if (forcedColumns[RESOURCE_PROFILE_KEY]) {
        setSamples(samples.map(s => ({
          ...s,
          resourceProfile: profile.key,
          resourceSettings: { ...generateDefaultResourceSettings(), ...profile.values }
        })));
      } else {
        setSamples(samples.map(s => {
          if (s.id === sampleId) {
            return {
              ...s,
              resourceProfile: profile.key,
              resourceSettings: { ...generateDefaultResourceSettings(), ...profile.values }
            };
          }
          const syncedSettings = resourceFields.reduce((settings, field) => {
            if (forcedColumns[field.key]) {
              settings[field.key] = profile.values[field.key];
            }
            return settings;
          }, { ...generateDefaultResourceSettings(), ...(s.resourceSettings || {}) });
          return {
            ...s,
            resourceSettings: syncedSettings
          };
        }));
      }
    }
  };

  const openOnlineProfilePanel = (sampleId) => {
    setOnlineProfileSampleId(sampleId);
    setResourceProfileDraft(prev => ({ ...prev, sampleId }));
    setResourceDbStatus('');
  };

  const closeOnlineProfilePanel = () => {
    setOnlineProfileSampleId('');
    setResourceDbStatus('');
  };

  const applyOnlineProfileToSample = (sampleId, profileId) => {
    const profile = userResourceProfiles.find(item => item.id === profileId);
    const sample = samples.find(item => item.id === sampleId);
    if (!profile || !sample) return;
    const confirmed = window.confirm(
      `Apply online resource profile "${profile.name}" to ${sample.name}?\n\nOnly this sample row will be changed.`
    );
    if (!confirmed) return;
    setSamples(samples.map(item => item.id === sampleId ? {
      ...item,
      resourceProfile: profile.id,
      resourceSettings: { ...generateDefaultResourceSettings(), ...profile.values }
    } : item));
    setResourceDbStatus(`Applied "${profile.name}" to ${sample.name}.`);
  };

  const persistUserResourceProfiles = (profiles) => {
    const normalized = profiles.map(normalizeUserProfile);
    setUserResourceProfiles(normalized);
    setStoredJson(RESOURCE_PROFILE_STORAGE_KEY, normalized);
    return normalized;
  };

  const updateResourceProfileDb = (patch) => {
    const nextSettings = { ...resourceProfileDb, ...patch };
    setResourceProfileDb(nextSettings);
    setStoredJson(RESOURCE_PROFILE_DB_STORAGE_KEY, nextSettings);
  };

  const getSupabaseConfig = () => ({
    supabaseUrl: (resourceProfileDb.supabaseUrl || DEFAULT_SUPABASE_URL).replace(/\/+$/, ''),
    publishableKey: resourceProfileDb.publishableKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY
  });

  const supabaseProfileUrl = (query = '') => {
    const { supabaseUrl } = getSupabaseConfig();
    return `${supabaseUrl}/rest/v1/${RESOURCE_PROFILE_TABLE}${query}`;
  };

  const remoteProfileHeaders = (extra = {}) => {
    const { publishableKey } = getSupabaseConfig();
    return {
      apikey: publishableKey,
      'Content-Type': 'application/json',
      ...extra
    };
  };

  const saveProfileToRemote = async (profile) => {
    const { supabaseUrl, publishableKey } = getSupabaseConfig();
    if (!supabaseUrl || !publishableKey) {
      setResourceDbStatus('Add a Supabase URL and publishable key before saving to the shared library.');
      return false;
    }
    try {
      const response = await fetch(supabaseProfileUrl(''), {
        method: 'POST',
        headers: remoteProfileHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(toSupabaseProfilePayload(profile))
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`${response.status} ${response.statusText}${message ? `: ${message}` : ''}`);
      }
      const rows = await response.json();
      const savedProfile = fromSupabaseProfileRow(Array.isArray(rows) ? rows[0] : rows);
      setResourceDbStatus(`Saved profile "${savedProfile.name}" to Supabase.`);
      return savedProfile;
    } catch (error) {
      setResourceDbStatus(`Supabase save failed: ${error.message || error}`);
      return false;
    }
  };

  const loadProfilesFromRemote = async () => {
    const { supabaseUrl, publishableKey } = getSupabaseConfig();
    if (!supabaseUrl || !publishableKey) {
      setResourceDbStatus('Add a Supabase URL and publishable key before loading.');
      return;
    }
    try {
      const response = await fetch(supabaseProfileUrl('?select=id,name,created_by,description,values,created_at&order=created_at.desc'), {
        headers: remoteProfileHeaders()
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`${response.status} ${response.statusText}${message ? `: ${message}` : ''}`);
      }
      const rows = await response.json();
      const normalized = persistUserResourceProfiles((Array.isArray(rows) ? rows : []).map(fromSupabaseProfileRow));
      setResourceDbStatus(`Loaded ${normalized.length} shared profile${normalized.length === 1 ? '' : 's'} from Supabase.`);
    } catch (error) {
      setResourceDbStatus(`Supabase load failed: ${error.message || error}`);
    }
  };

  const saveCurrentSampleResourceProfile = async () => {
    const sampleId = resourceProfileDraft.sampleId || samples[0]?.id;
    const sample = samples.find(item => item.id === sampleId);
    if (!sample) {
      setResourceDbStatus('Select a sample before saving a profile.');
      return;
    }
    const name = resourceProfileDraft.name.trim();
    if (!name) {
      setResourceDbStatus('Profile name is required.');
      return;
    }
    const localProfile = normalizeUserProfile({
      name,
      createdBy: resourceProfileDraft.createdBy.trim(),
      description: resourceProfileDraft.description.trim(),
      values: sample.resourceSettings || generateDefaultResourceSettings()
    });
    setResourceProfileDraft({ name: '', createdBy: resourceProfileDraft.createdBy, description: '', sampleId });
    const remoteProfile = await saveProfileToRemote(localProfile);
    const nextProfile = remoteProfile || localProfile;
    persistUserResourceProfiles([nextProfile, ...userResourceProfiles.filter(profile => profile.id !== nextProfile.id)]);
    if (!remoteProfile) {
      setResourceDbStatus(`Saved profile "${nextProfile.name}" locally only.`);
    }
  };

  const deleteUserResourceProfile = async (profileId) => {
    const profile = userResourceProfiles.find(item => item.id === profileId);
    if (!profile) return;
    const confirmed = window.confirm(`Delete user resource profile "${profile.name}"?`);
    if (!confirmed) return;
    const nextProfiles = persistUserResourceProfiles(userResourceProfiles.filter(item => item.id !== profileId));
    setSamples(samples.map(sample => sample.resourceProfile === profileId ? { ...sample, resourceProfile: '' } : sample));
    setResourceDbStatus(`Deleted profile "${profile.name}" locally.`);
    const { supabaseUrl, publishableKey } = getSupabaseConfig();
    if (supabaseUrl && publishableKey) {
      try {
        const response = await fetch(supabaseProfileUrl(`?id=eq.${encodeURIComponent(profileId)}`), {
          method: 'DELETE',
          headers: remoteProfileHeaders()
        });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(`${response.status} ${response.statusText}${message ? `: ${message}` : ''}`);
        }
        setResourceDbStatus(`Deleted profile "${profile.name}" from Supabase.`);
      } catch (error) {
        persistUserResourceProfiles(nextProfiles);
        setResourceDbStatus(`Deleted locally, but Supabase delete failed: ${error.message || error}`);
      }
    }
  };

  const offerResourceSettingsFromConfig = (content, label, sampleId = null) => {
    if (!hasResourceConfigContent(content)) return;
    const parsedResources = parseResourceConfig(content);
    const confirmed = window.confirm(
      `Load Computational Resource defaults from ${label}?\n\nThis will update ${sampleId ? 'that sample resource row' : 'all sample resource rows'} from the config file. Sample table parameters from the config are still loaded separately.`
    );
    if (confirmed) {
      setConfigResourceDefaults(parsedResources);
      if (sampleId) {
        setSamples(currentSamples => currentSamples.map(s => s.id === sampleId ? {
          ...s,
          resourceDefaults: parsedResources,
          resourceSettings: parsedResources,
          resourceProfile: ''
        } : {
          ...s,
          resourceSettings: resourceFields.reduce((settings, field) => {
            if (forcedColumns[field.key]) {
              settings[field.key] = parsedResources[field.key];
            }
            return settings;
          }, { ...generateDefaultResourceSettings(), ...(s.resourceSettings || {}) })
        }));
      } else {
        setSamples(currentSamples => currentSamples.map(s => ({
          ...s,
          resourceDefaults: parsedResources,
          resourceSettings: parsedResources,
          resourceProfile: ''
        })));
      }
    }
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
        offerResourceSettingsFromConfig(content, `sample config "${file.name}"`, id);

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
        const parsedResources = parseResourceConfig(content);
        setConfigResourceDefaults(parsedResources);
        setSamples(prevSamples => prevSamples.map(sample => ({
          ...sample,
          resourceDefaults: parsedResources,
          resourceSettings: parsedResources,
          resourceProfile: ''
        })));
        
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
        params: { ...sample.params },
        resourceSettings: { ...generateDefaultResourceSettings(), ...(sample.resourceSettings || {}) },
        resourceDefaults: { ...generateDefaultResourceSettings(), ...(sample.resourceDefaults || configResourceDefaults) },
        resourceProfile: sample.resourceProfile || ''
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
          let fallbackResourceSettings = generateDefaultResourceSettings();
          if (data.globalSettings) {
            setBaseOutputDir(data.globalSettings.baseOutputDir || '');
            setAnalysisName(data.globalSettings.analysisName || '');
            setTowerToken(data.globalSettings.towerToken || '');
            setGoogleCreds(data.globalSettings.googleCreds || './pipeline-service-key.json');
            setRepoBranch(data.globalSettings.repoBranch || 'main');
            const restoredMainConfig = data.globalSettings.mainNfContent || '';
            const parsedResources = parseResourceConfig(restoredMainConfig);
            setMainNfContent(restoredMainConfig);   // <--- Restoring base config
            setMainNfFileName(data.globalSettings.mainNfFileName || ''); // <--- Restoring base filename
            setConfigResourceDefaults(parsedResources);
            fallbackResourceSettings = normalizeResourceSettings({ ...parsedResources, ...(data.globalSettings.resourceSettings || {}) });
          }
          if (data.forcedColumns) {
            setForcedColumns(data.forcedColumns);
          }
          const restoredSamples = data.samples.map(s => ({
            ...withSampleResourceState(
              {
                ...s,
                file: null,
                ...(s.sampleConfigContent && hasResourceConfigContent(s.sampleConfigContent) && !s.resourceSettings
                  ? {
                      resourceDefaults: parseResourceConfig(s.sampleConfigContent),
                      resourceSettings: parseResourceConfig(s.sampleConfigContent)
                    }
                  : {})
              },
              fallbackResourceSettings
            )
          }));
          setSamples(restoredSamples);
        } 
        // Fallback for older export format (array of objects)
        else if (Array.isArray(data)) {
          const restoredSamples = data.map(s => ({
            id: createId(),
            name: s.sample_name || 'Restored Sample',
            file: null,
            fileName: s.attached_file || '',
            sampleConfigFileName: '',
            sampleConfigContent: '',
            params: { ...generateDefaultParams(), ...s.parameters },
            ...createDefaultResourceState()
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
        let fallbackResourceSettings = generateDefaultResourceSettings();
        if (data.globalSettings) {
          setBaseOutputDir(data.globalSettings.baseOutputDir || '');
          setAnalysisName(data.globalSettings.analysisName || '');
          setTowerToken(data.globalSettings.towerToken || '');
          setGoogleCreds(data.globalSettings.googleCreds || './pipeline-service-key.json');
          setRepoBranch(data.globalSettings.repoBranch || 'main');
          const restoredMainConfig = data.globalSettings.mainNfContent || '';
          const parsedResources = parseResourceConfig(restoredMainConfig);
          setMainNfContent(restoredMainConfig);
          setMainNfFileName(data.globalSettings.mainNfFileName || '');
          setConfigResourceDefaults(parsedResources);
          fallbackResourceSettings = normalizeResourceSettings({ ...parsedResources, ...(data.globalSettings.resourceSettings || {}) });
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
          let finalResourceDefaults = s.resourceDefaults || fallbackResourceSettings;
          let finalResourceSettings = s.resourceSettings || finalResourceDefaults;
          let finalResourceProfile = s.resourceProfile || '';

          // Dynamically read the actual nextflow.config from the sample directory
          // This ensures if the user manually modified the configs after exporting, we capture those updates!
          const sampleConfigFile = files.find(f => f.webkitRelativePath.endsWith(`${safeName}/nextflow.config`));
          if (sampleConfigFile) {
            try {
              const configText = await sampleConfigFile.text();
              const parsedParams = parseConfigFile(configText, paramSchema);
              if (hasResourceConfigContent(configText)) {
                const parsedResources = parseResourceConfig(configText);
                finalResourceDefaults = parsedResources;
                finalResourceSettings = parsedResources;
                finalResourceProfile = '';
              }
              // Merge/Override with the parameters actually found in the sample's directory config
              finalParams = { ...finalParams, ...parsedParams };
            } catch (err) {
              console.warn(`Could not read config for ${safeName}`, err);
            }
          }

          return {
            ...withSampleResourceState({
              ...s,
              file: foundFile, // Restore the actual File object!
              params: finalParams,
              resourceDefaults: finalResourceDefaults,
              resourceSettings: finalResourceSettings,
              resourceProfile: finalResourceProfile
            }, fallbackResourceSettings)
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
        params: { ...sample.params },
        resourceSettings: { ...generateDefaultResourceSettings(), ...(sample.resourceSettings || {}) },
        resourceDefaults: { ...generateDefaultResourceSettings(), ...(sample.resourceDefaults || configResourceDefaults) },
        resourceProfile: sample.resourceProfile || ''
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

      nfConfigContent += buildResourceOverrideConfig(sample.resourceSettings || generateDefaultResourceSettings());

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

  const formatResourceDefault = (sample, field) => {
    const value = sample.resourceDefaults?.[field.key] ?? configResourceDefaults[field.key];
    if (!hasResourceValue(value)) return 'Dev baseline: unset';
    if (field.type === 'boolean') return `Config default: ${value ? 'true' : 'false'}`;
    if (field.suffix) return `Config default: ${value} ${field.suffix}`;
    return `Config default: ${value}`;
  };

  const renderResourceInput = (sample, field) => {
    const rawValue = sample.resourceSettings?.[field.key];
    const value = rawValue !== undefined ? rawValue : '';
    const isForced = forcedColumns[field.key];
    const inputClasses = `w-full text-sm border rounded-md shadow-sm focus:ring-cyan-500 focus:border-cyan-500 px-3 py-2 text-slate-800 ${isForced ? 'bg-cyan-100 border-cyan-500' : 'bg-white border-cyan-300'}`;

    if (field.type === 'boolean') {
      return (
        <label className="flex items-center gap-2 text-sm font-medium text-cyan-950 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => updateResourceSetting(sample.id, field.key, event.target.checked)}
            className="h-4 w-4 rounded border-cyan-300 text-cyan-600 focus:ring-cyan-500"
          />
          Enabled
        </label>
      );
    }

    if (field.type === 'select') {
      return (
        <select
          value={value || 'inherit'}
          onChange={(event) => updateResourceSetting(sample.id, field.key, event.target.value)}
          className={inputClasses}
        >
          {field.options.map(option => (
            <option key={option} value={option}>
              {option === 'inherit' ? 'inherit from config' : option}
            </option>
          ))}
        </select>
      );
    }

    return (
      <div className="relative">
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(event) => updateResourceSetting(
            sample.id,
            field.key,
            field.type === 'number'
              ? (event.target.value === '' ? '' : Number(event.target.value))
              : event.target.value
          )}
          className={`${inputClasses} ${field.suffix ? 'pr-12' : ''}`}
          placeholder={field.placeholder || ''}
          min={field.min}
        />
        {field.suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-cyan-700">
            {field.suffix}
          </span>
        )}
      </div>
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Sample Configuration Matrix</h2>
            <p className="text-xs text-slate-500 mt-0.5">Resource columns are per sample and can be force-synced like other parameters.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowResourceSettings(!showResourceSettings)}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold border transition-colors ${showResourceSettings ? 'bg-cyan-700 text-white border-cyan-700 hover:bg-cyan-800' : 'bg-white text-cyan-800 border-cyan-300 hover:bg-cyan-50'}`}
          >
            <SlidersHorizontal size={16} />
            {showResourceSettings ? 'Hide Resource Columns' : 'Show Resource Columns'}
          </button>
        </div>
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
                {showResourceSettings && resourceFields.map((field) => {
                  const isForced = forcedColumns[field.key];
                  return (
                    <th
                      key={`resource-${field.key}`}
                      className={`p-3 border-b border-cyan-200 min-w-[210px] align-bottom transition-colors duration-300 ${isForced ? 'bg-cyan-200 border-cyan-300' : 'bg-cyan-50'}`}
                    >
                      <div className="flex flex-col gap-2 h-full justify-end">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-sm font-medium break-words whitespace-normal leading-tight ${isForced ? 'text-cyan-950' : 'text-cyan-900'}`}>
                            {field.label}
                            <span className="ml-1 inline-block px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[10px] uppercase font-bold tracking-wider align-middle">Resource</span>
                          </span>
                          <button
                            onClick={() => toggleForceColumn(field.key)}
                            className={`p-1.5 rounded-md transition-all flex-shrink-0 ${isForced ? 'bg-cyan-600 text-white shadow-inner hover:bg-cyan-700' : 'bg-white text-cyan-500 border border-cyan-200 hover:bg-cyan-100 hover:text-cyan-700'}`}
                            title={isForced ? "Unlock resource column" : "Force same across all samples"}
                          >
                            {isForced ? <Link size={14} /> : <Link2Off size={14} />}
                          </button>
                        </div>
                      </div>
                    </th>
                  );
                })}
                {showResourceSettings && (
                  <th className={`p-3 border-b border-cyan-200 min-w-[260px] align-bottom transition-colors duration-300 ${forcedColumns[RESOURCE_PROFILE_KEY] ? 'bg-cyan-200 border-cyan-300' : 'bg-cyan-50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium break-words whitespace-normal leading-tight text-cyan-900">
                        Resource Profile
                        <span className="ml-1 inline-block px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[10px] uppercase font-bold tracking-wider align-middle">Resource</span>
                      </span>
                      <button
                        onClick={() => toggleForceColumn(RESOURCE_PROFILE_KEY)}
                        className={`p-1.5 rounded-md transition-all flex-shrink-0 ${forcedColumns[RESOURCE_PROFILE_KEY] ? 'bg-cyan-600 text-white shadow-inner hover:bg-cyan-700' : 'bg-white text-cyan-500 border border-cyan-200 hover:bg-cyan-100 hover:text-cyan-700'}`}
                        title={forcedColumns[RESOURCE_PROFILE_KEY] ? "Unlock resource profile" : "Force same profile across all samples"}
                      >
                        {forcedColumns[RESOURCE_PROFILE_KEY] ? <Link size={14} /> : <Link2Off size={14} />}
                      </button>
                    </div>
                  </th>
                )}
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
                  {showResourceSettings && resourceFields.map(field => {
                     const isForced = forcedColumns[field.key];
                     return (
                        <td key={`resource-${field.key}`} className={`p-3 align-middle border-l border-cyan-100 ${isForced ? 'bg-cyan-100/70' : 'bg-cyan-50/40'}`}>
                          <div className="flex flex-col gap-1">
                            {renderResourceInput(sample, field)}
                            <div className="text-[10px] font-medium text-cyan-700 whitespace-normal leading-tight">
                              {formatResourceDefault(sample, field)}
                            </div>
                          </div>
                        </td>
                     );
                  })}
                  {showResourceSettings && (
                    <td className={`p-3 align-top border-l border-cyan-100 ${forcedColumns[RESOURCE_PROFILE_KEY] ? 'bg-cyan-100/70' : 'bg-cyan-50/40'}`}>
                      <div className="flex flex-col gap-2">
                        <select
                          value={sample.resourceProfile || ''}
                          onChange={(event) => applyResourceProfile(sample.id, event.target.value)}
                          className={`w-full border rounded-md px-3 py-2 text-sm focus:ring-cyan-500 focus:border-cyan-500 ${forcedColumns[RESOURCE_PROFILE_KEY] ? 'bg-cyan-100 border-cyan-500' : 'bg-white border-cyan-300'}`}
                        >
                          <option value="">Apply profile...</option>
                          <option value={DEFAULT_RESOURCE_PROFILE_KEY}>Default from config</option>
                          {resourceProfiles.map(profile => (
                            <option key={profile.key} value={profile.key}>{profile.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => resetResourceSettingsToConfigDefaults(sample.id)}
                          className="inline-flex items-center justify-center gap-1.5 border border-cyan-300 text-cyan-800 bg-white hover:bg-cyan-100 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                        >
                          <RotateCcw size={13} />
                          Reset defaults
                        </button>
                        <button
                          type="button"
                          onClick={() => openOnlineProfilePanel(sample.id)}
                          className="inline-flex items-center justify-center gap-1.5 border border-cyan-700 text-white bg-cyan-700 hover:bg-cyan-800 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                        >
                          <Save size={13} />
                          Online profiles
                        </button>
                      </div>
                    </td>
                  )}
                  
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

      {activeOnlineProfileSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-auto rounded-xl bg-white shadow-2xl border border-cyan-200">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-cyan-200 bg-cyan-50 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-cyan-950">Online Resource Profiles</h3>
                <p className="text-xs text-cyan-700 mt-1">
                  Current row: <span className="font-semibold">{activeOnlineProfileSample.name}</span>. Online profile actions only change this sample row.
                </p>
              </div>
              <button
                type="button"
                onClick={closeOnlineProfilePanel}
                className="rounded-md border border-cyan-300 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-5">
              <div className="rounded-lg border border-cyan-200 bg-white p-4">
                <h4 className="text-sm font-bold text-cyan-950 mb-3">Connection</h4>
                <div className="grid grid-cols-1 gap-3">
                  <input
                    type="text"
                    value={resourceProfileDb.supabaseUrl || DEFAULT_SUPABASE_URL}
                    onChange={(event) => updateResourceProfileDb({ supabaseUrl: event.target.value.trim() })}
                    className="w-full border border-cyan-300 rounded-md px-3 py-2 text-sm focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="Supabase project URL"
                  />
                  <input
                    type="password"
                    value={resourceProfileDb.publishableKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY}
                    onChange={(event) => updateResourceProfileDb({ publishableKey: event.target.value.trim() })}
                    className="w-full border border-cyan-300 rounded-md px-3 py-2 text-sm focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="Supabase publishable key"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={loadProfilesFromRemote}
                      className="flex-1 border border-cyan-300 text-cyan-800 bg-cyan-50 hover:bg-cyan-100 px-3 py-2 rounded-md text-xs font-semibold"
                    >
                      Load shared profiles
                    </button>
                    <button
                      type="button"
                      onClick={() => updateResourceProfileDb(defaultResourceDbSettings)}
                      className="border border-cyan-300 text-cyan-800 bg-white hover:bg-cyan-50 px-3 py-2 rounded-md text-xs font-semibold"
                    >
                      Reset
                    </button>
                  </div>
                  <p className="text-[11px] text-cyan-700 leading-relaxed">
                    No online profiles are loaded until this button is used. The page stores connection fields only in this browser.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-cyan-200 bg-white p-4">
                <h4 className="text-sm font-bold text-cyan-950 mb-3">Save This Row Online</h4>
                <div className="grid grid-cols-1 gap-3">
                  <input
                    type="text"
                    value={resourceProfileDraft.name}
                    onChange={(event) => setResourceProfileDraft(prev => ({ ...prev, name: event.target.value, sampleId: activeOnlineProfileSample.id }))}
                    className="w-full border border-cyan-300 rounded-md px-3 py-2 text-sm focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="Profile name"
                  />
                  <input
                    type="text"
                    value={resourceProfileDraft.createdBy}
                    onChange={(event) => setResourceProfileDraft(prev => ({ ...prev, createdBy: event.target.value, sampleId: activeOnlineProfileSample.id }))}
                    className="w-full border border-cyan-300 rounded-md px-3 py-2 text-sm focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="Created by"
                  />
                  <textarea
                    value={resourceProfileDraft.description}
                    onChange={(event) => setResourceProfileDraft(prev => ({ ...prev, description: event.target.value, sampleId: activeOnlineProfileSample.id }))}
                    className="w-full border border-cyan-300 rounded-md px-3 py-2 text-sm focus:ring-cyan-500 focus:border-cyan-500 min-h-[88px]"
                    placeholder="Description"
                  />
                  <button
                    type="button"
                    onClick={saveCurrentSampleResourceProfile}
                    className="border border-cyan-700 text-white bg-cyan-700 hover:bg-cyan-800 px-3 py-2 rounded-md text-sm font-semibold"
                  >
                    Save this row online
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-cyan-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="text-sm font-bold text-cyan-950">Loaded Online Profiles</h4>
                  <span className="text-xs font-semibold text-cyan-700">{userResourceProfiles.length}</span>
                </div>
                <div className="max-h-80 overflow-auto space-y-2">
                  {userResourceProfiles.length === 0 ? (
                    <p className="text-xs text-cyan-700">No profiles loaded. Use Load shared profiles when you want to fetch them.</p>
                  ) : userResourceProfiles.map(profile => (
                    <div key={profile.id} className="border border-cyan-100 rounded-md p-3 bg-cyan-50/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-cyan-950 truncate">{profile.name}</div>
                          <div className="text-[11px] text-cyan-700 truncate">{profile.createdBy ? `Created by ${profile.createdBy}` : 'Creator not set'}</div>
                          {profile.description && (
                            <div className="text-xs text-slate-600 mt-1 whitespace-normal leading-snug">{profile.description}</div>
                          )}
                          <button
                            type="button"
                            onClick={() => applyOnlineProfileToSample(activeOnlineProfileSample.id, profile.id)}
                            className="mt-2 inline-flex items-center justify-center border border-cyan-300 text-cyan-800 bg-white hover:bg-cyan-100 px-2.5 py-1 rounded-md text-xs font-semibold"
                          >
                            Apply to this row
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteUserResourceProfile(profile.id)}
                          className="text-slate-400 hover:text-red-600 transition-colors flex-shrink-0"
                          title="Delete online profile"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {resourceDbStatus && (
                  <p className="text-[11px] text-cyan-800 mt-3 leading-relaxed">{resourceDbStatus}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
