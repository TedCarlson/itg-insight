// path: apps/web/src/features/admin/home-editor/components/BlockEditor.tsx

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import type { DraftBlock } from "../lib/homeEditorTypes";
import TextArea from "./TextArea";

type Props = {
  block: DraftBlock;
  onChange: (next: DraftBlock) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableMoveUp: boolean;
  disableMoveDown: boolean;
};

function defaultConfigForType(blockType: DraftBlock["block_type"]) {
  if (blockType === "narrative") return { subtitle: "", text: "" };
  if (blockType === "kpi_row") {
    return { subtitle: "", items: [{ label: "", value: "—", sub: "" }] };
  }

  return { items: [{ label: "", href: "", sub: "" }] };
}

function updateItem(
  block: DraftBlock,
  index: number,
  patch: Record<string, string>
) {
  const items = Array.isArray(block.config?.items) ? [...block.config.items] : [];
  items[index] = { ...items[index], ...patch };
  return { ...(block.config ?? {}), items };
}

function removeItem(block: DraftBlock, index: number) {
  const items = Array.isArray(block.config?.items) ? [...block.config.items] : [];
  items.splice(index, 1);
  return { ...(block.config ?? {}), items };
}

export default function BlockEditor({
  block,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
}: Props) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: "var(--to-border)",
        background: "var(--to-surface)",
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <div className="to-label">Title</div>
              <TextInput
                value={block.title}
                onChange={(event) =>
                  onChange({ ...block, title: event.target.value })
                }
              />
            </div>

            <div>
              <div className="to-label">Type</div>
              <Select
                value={block.block_type}
                onChange={(event) => {
                  const nextType = event.target.value as DraftBlock["block_type"];
                  onChange({
                    ...block,
                    block_type: nextType,
                    config: defaultConfigForType(nextType),
                  });
                }}
              >
                <option value="kpi_row">KPI Row</option>
                <option value="narrative">Narrative</option>
                <option value="link_list">Link List</option>
              </Select>
            </div>
          </div>

          <div className="mt-3">
            {block.block_type === "narrative" ? (
              <>
                <div className="to-label">Subtitle (optional)</div>
                <TextInput
                  value={String(block.config?.subtitle ?? "")}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      config: {
                        ...(block.config ?? {}),
                        subtitle: event.target.value,
                      },
                    })
                  }
                />

                <div className="to-label mt-3">Text</div>
                <TextArea
                  value={String(block.config?.text ?? "")}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      config: { ...(block.config ?? {}), text: value },
                    })
                  }
                />
              </>
            ) : block.block_type === "kpi_row" ? (
              <>
                <div className="to-label">Subtitle (optional)</div>
                <TextInput
                  value={String(block.config?.subtitle ?? "")}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      config: {
                        ...(block.config ?? {}),
                        subtitle: event.target.value,
                      },
                    })
                  }
                />

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm font-medium">KPI items</div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const items = Array.isArray(block.config?.items)
                        ? [...block.config.items]
                        : [];

                      items.push({ label: "", value: "—", sub: "" });

                      onChange({
                        ...block,
                        config: { ...(block.config ?? {}), items },
                      });
                    }}
                  >
                    Add item
                  </Button>
                </div>

                <div className="mt-2 grid gap-2">
                  {(Array.isArray(block.config?.items)
                    ? block.config.items
                    : []
                  ).map((item: any, index: number) => (
                    <div
                      key={index}
                      className="rounded-lg border p-3"
                      style={{
                        borderColor: "var(--to-border)",
                        background: "var(--to-surface-2)",
                      }}
                    >
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div>
                          <div className="to-label">Label</div>
                          <TextInput
                            value={String(item?.label ?? "")}
                            onChange={(event) =>
                              onChange({
                                ...block,
                                config: updateItem(block, index, {
                                  label: event.target.value,
                                }),
                              })
                            }
                          />
                        </div>

                        <div>
                          <div className="to-label">Value</div>
                          <TextInput
                            value={String(item?.value ?? "")}
                            onChange={(event) =>
                              onChange({
                                ...block,
                                config: updateItem(block, index, {
                                  value: event.target.value,
                                }),
                              })
                            }
                          />
                        </div>

                        <div>
                          <div className="to-label">Sub</div>
                          <TextInput
                            value={String(item?.sub ?? "")}
                            onChange={(event) =>
                              onChange({
                                ...block,
                                config: updateItem(block, index, {
                                  sub: event.target.value,
                                }),
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-2 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            onChange({
                              ...block,
                              config: removeItem(block, index),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-sm font-medium">Links</div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const items = Array.isArray(block.config?.items)
                        ? [...block.config.items]
                        : [];

                      items.push({ label: "", href: "", sub: "" });

                      onChange({
                        ...block,
                        config: { ...(block.config ?? {}), items },
                      });
                    }}
                  >
                    Add link
                  </Button>
                </div>

                <div className="mt-2 grid gap-2">
                  {(Array.isArray(block.config?.items)
                    ? block.config.items
                    : []
                  ).map((item: any, index: number) => (
                    <div
                      key={index}
                      className="rounded-lg border p-3"
                      style={{
                        borderColor: "var(--to-border)",
                        background: "var(--to-surface-2)",
                      }}
                    >
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div>
                          <div className="to-label">Label</div>
                          <TextInput
                            value={String(item?.label ?? "")}
                            onChange={(event) =>
                              onChange({
                                ...block,
                                config: updateItem(block, index, {
                                  label: event.target.value,
                                }),
                              })
                            }
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <div className="to-label">Href</div>
                          <TextInput
                            value={String(item?.href ?? "")}
                            onChange={(event) =>
                              onChange({
                                ...block,
                                config: updateItem(block, index, {
                                  href: event.target.value,
                                }),
                              })
                            }
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <div className="to-label">Sub</div>
                          <TextInput
                            value={String(item?.sub ?? "")}
                            onChange={(event) =>
                              onChange({
                                ...block,
                                config: updateItem(block, index, {
                                  sub: event.target.value,
                                }),
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-2 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            onChange({
                              ...block,
                              config: removeItem(block, index),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2 sm:flex-col sm:items-stretch">
          <Button
            type="button"
            variant="secondary"
            disabled={disableMoveUp}
            onClick={onMoveUp}
          >
            Up
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={disableMoveDown}
            onClick={onMoveDown}
          >
            Down
          </Button>

          <Button type="button" variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}