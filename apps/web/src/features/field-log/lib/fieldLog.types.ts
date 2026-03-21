export type FieldLogCategory = {
  category_key: string;
  label: string;
  description: string | null;
  sort_order: number;
};

export type FieldLogSubcategory = {
  category_key: string;
  subcategory_key: string;
  label: string;
  description: string | null;
  sort_order: number;
};

export type FieldLogUcode = {
  ucode: string;
  label: string;
  sort_order: number;
};

export type FieldLogPhotoRequirement = {
  photo_label_key: string;
  label: string;
  required: boolean;
  sort_order: number;
};

export type FieldLogRule = {
  rule_id: string;
  category_key: string;
  category_label: string | null;
  subcategory_key: string | null;
  subcategory_label: string | null;
  show_subcategory: boolean;
  require_subcategory: boolean;
  show_ucode: boolean;
  require_ucode: boolean;
  ucode_group_key: string | null;
  ucodes: FieldLogUcode[];
  xm_allowed: boolean;
  comment_required: boolean;
  min_photo_count: number;
  location_required: boolean;
  location_compare_required: boolean;
  location_tolerance_m: number | null;
  allow_technician_submit: boolean;
  allow_supervisor_submit: boolean;
  active_text_instruction: string | null;
  photo_requirements: FieldLogPhotoRequirement[];
  sort_order: number;
};

export type FieldLogRuntimeConfig = {
  config_version_id: string;
  version_no: number;
  label: string | null;
  notes: string | null;
  published_at: string | null;
};

export type FieldLogRuntimeBootstrap = {
  config: FieldLogRuntimeConfig | null;
  categories: FieldLogCategory[];
  subcategories: FieldLogSubcategory[];
  rules: FieldLogRule[];
  ucodes: FieldLogUcode[];
};