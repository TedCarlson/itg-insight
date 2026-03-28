export function isTnpsKey(kpiKey: string): boolean {
  return kpiKey.toLowerCase().includes("tnps");
}

export function isToolUsageKey(kpiKey: string): boolean {
  const k = kpiKey.toLowerCase();
  return k.includes("tool_usage") || k.includes("toolusage") || k.includes("tu_rate");
}

export function isPurePassKey(kpiKey: string): boolean {
  const k = kpiKey.toLowerCase();
  return k.includes("pure_pass") || k.includes("purepass") || k.includes("pht_pure_pass");
}

export function is48HrKey(kpiKey: string): boolean {
  const k = kpiKey.toLowerCase();
  return k.includes("48hr") || k.includes("48_hr") || k.includes("callback");
}

export function isRepeatKey(kpiKey: string): boolean {
  return kpiKey.toLowerCase().includes("repeat");
}

export function isSoiKey(kpiKey: string): boolean {
  return kpiKey.toLowerCase().includes("soi");
}

export function isReworkKey(kpiKey: string): boolean {
  return kpiKey.toLowerCase().includes("rework");
}

export function isMetKey(kpiKey: string): boolean {
  const k = kpiKey.toLowerCase();
  return k === "met_rate" || k === "met" || k.includes("metrate");
}