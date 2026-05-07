import {
  BookOpen,
  Check,
  Edit2,
  Languages,
  Loader2,
  MessageSquare,
  PenTool,
  Plus,
  SpellCheck,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useState } from "react";
import type { PromptAction, ProviderConfig } from "./types";
import {
  createPromptAction,
  defaultPromptActions,
  savePromptActions,
} from "./storage";

const ICON_OPTIONS = [
  { name: "SpellCheck", icon: SpellCheck },
  { name: "Languages", icon: Languages },
  { name: "BookOpen", icon: BookOpen },
  { name: "PenTool", icon: PenTool },
  { name: "Wand2", icon: Wand2 },
  { name: "MessageSquare", icon: MessageSquare },
];

function getIconByName(name: string) {
  return ICON_OPTIONS.find((o) => o.name === name)?.icon ?? SpellCheck;
}

const SYSTEM_PROMPT_TEMPLATES = [
  { label: "纠正语法", prompt: "You are an English teacher. Correct the grammar of the following text without changing its meaning. Output only the corrected text:\n\n" },
  { label: "翻译英文", prompt: "You are a translator. Translate the following Chinese text to English. Output only the translation:\n\n" },
  { label: "翻译中文", prompt: "You are a translator. Translate the following English text to Chinese. Output only the translation:\n\n" },
  { label: "解释意思", prompt: "You are an English teacher. Explain the meaning of the following text in Chinese, including key vocabulary and grammar points:\n\n" },
  { label: "改写润色", prompt: "You are a writing assistant. Rewrite the following text to make it more polished, natural, and well-structured while keeping the same meaning:\n\n" },
  { label: "空白", prompt: "You are a helpful assistant. " },
];

type EditingState =
  | { mode: "view" }
  | { mode: "edit"; label: string; shortLabel: string; systemPrompt: string; iconName: string };

export function PromptConfigModal({
  actions,
  onClose,
  onSave,
  activeProvider,
  onGeneratePrompt,
}: {
  actions: PromptAction[];
  onClose: () => void;
  onSave: (actions: PromptAction[]) => void;
  activeProvider: ProviderConfig | undefined;
  onGeneratePrompt: (description: string) => Promise<string>;
}) {
  const [items, setItems] = useState<PromptAction[]>(actions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditingState>({ mode: "view" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateDescription, setGenerateDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  function startEdit(item: PromptAction) {
    setEditingId(item.id);
    setEditState({
      mode: "edit",
      label: item.label,
      shortLabel: item.shortLabel,
      systemPrompt: item.systemPrompt,
      iconName: item.iconName ?? "SpellCheck",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState({ mode: "view" });
  }

  function saveEdit(id: string) {
    if (editState.mode !== "edit") return;
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              label: editState.label.slice(0, 20),
              shortLabel: editState.shortLabel.slice(0, 20) || editState.label.slice(0, 10),
              systemPrompt: editState.systemPrompt,
              iconName: editState.iconName,
            }
          : item,
      ),
    );
    setEditingId(null);
    setEditState({ mode: "view" });
  }

  function deleteItem(id: string) {
    if (items.length <= 1) return;
    setItems((current) => current.filter((item) => item.id !== id));
    setConfirmDeleteId(null);
  }

  function addNew() {
    const newAction = createPromptAction();
    setItems((current) => [...current, newAction]);
    startEdit(newAction);
  }

  async function addAIGenerated() {
    if (!generateDescription.trim()) return;
    setIsGenerating(true);
    try {
      const generatedPrompt = await onGeneratePrompt(generateDescription.trim());
      const newAction: PromptAction = {
        id: crypto.randomUUID(),
        type: "explain",
        label: "AI Generated",
        shortLabel: "AI",
        description: generateDescription.trim().slice(0, 50),
        systemPrompt: generatedPrompt,
        iconName: "Wand2",
      };
      setItems((current) => [...current, newAction]);
      setShowGenerateDialog(false);
      setGenerateDescription("");
      startEdit(newAction);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleRestoreDefaults() {
    savePromptActions(defaultPromptActions);
    onSave(defaultPromptActions);
    setShowRestoreConfirm(false);
    onClose();
  }

  function handleSaveAndClose() {
    savePromptActions(items);
    onSave(items);
    onClose();
  }

  const previewLength = 80;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section
        className="provider-panel prompt-config-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-config-title"
      >
        <header className="provider-panel-header">
          <div>
            <h2 id="prompt-config-title">Configure Prompts</h2>
            <p>Customize button labels, system prompts, and icons. Changes are saved automatically.</p>
          </div>
          <div className="prompt-config-header-actions">
            <button
              className="button button-ghost button-compact"
              type="button"
              onClick={() => setShowGenerateDialog(true)}
              title="AI Generate new prompt"
            >
              <Wand2 size={14} strokeWidth={2.5} />
              AI Generate
            </button>
            <button className="button button-primary" type="button" onClick={handleSaveAndClose}>
              Done
            </button>
          </div>
        </header>

        <div className="prompt-config-list">
          {items.map((item) => {
            const isEditing = editingId === item.id;
            return (
              <article className="prompt-config-item" key={item.id}>
                {isEditing && editState.mode === "edit" ? (
                  <div className="prompt-config-edit">
                    <div className="prompt-config-edit-row">
                      <label className="prompt-config-field">
                        <span>Button Label (max 20)</span>
                        <input
                          className="provider-name-input"
                          value={editState.label}
                          onChange={(e) =>
                            setEditState((s) =>
                              s.mode === "edit"
                                ? { ...s, label: e.target.value }
                                : s,
                            )
                          }
                          maxLength={20}
                        />
                      </label>
                      <label className="prompt-config-field">
                        <span>Short Label (max 20)</span>
                        <input
                          className="provider-name-input"
                          value={editState.shortLabel}
                          onChange={(e) =>
                            setEditState((s) =>
                              s.mode === "edit"
                                ? { ...s, shortLabel: e.target.value }
                                : s,
                            )
                          }
                          maxLength={20}
                        />
                      </label>
                    </div>

                    <div className="prompt-config-edit-row">
                      <label className="prompt-config-field prompt-config-field--icon">
                        <span>Icon</span>
                        <div className="prompt-icon-picker">
                          {ICON_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            const selected = editState.iconName === opt.name;
                            return (
                              <button
                                key={opt.name}
                                type="button"
                                className={`prompt-icon-option ${selected ? "prompt-icon-option--selected" : ""}`}
                                onClick={() =>
                                  setEditState((s) =>
                                    s.mode === "edit"
                                      ? { ...s, iconName: opt.name }
                                      : s,
                                  )
                                }
                                title={opt.name}
                              >
                                <Icon size={16} strokeWidth={2} />
                              </button>
                            );
                          })}
                        </div>
                      </label>
                      <label className="prompt-config-field">
                        <span>Quick Template</span>
                        <select
                          className="provider-fields"
                          value=""
                          onChange={(e) => {
                            const tmpl = SYSTEM_PROMPT_TEMPLATES[Number(e.target.value)];
                            if (tmpl) {
                              setEditState((s) =>
                                s.mode === "edit"
                                  ? {
                                      ...s,
                                      systemPrompt: tmpl.prompt,
                                      label: tmpl.label.slice(0, 20),
                                      shortLabel: tmpl.label.slice(0, 10),
                                    }
                                  : s,
                              );
                            }
                            e.target.value = "";
                          }}
                        >
                          <option value="">Choose template...</option>
                          {SYSTEM_PROMPT_TEMPLATES.map((tmpl, i) => (
                            <option key={tmpl.label} value={i}>
                              {tmpl.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="prompt-config-field">
                      <span>System Prompt</span>
                      <textarea
                        className="prompt-config-textarea"
                        value={editState.systemPrompt}
                        onChange={(e) =>
                          setEditState((s) =>
                            s.mode === "edit"
                              ? { ...s, systemPrompt: e.target.value }
                              : s,
                          )
                        }
                        rows={4}
                      />
                    </label>

                    <div className="prompt-config-edit-actions">
                      <button
                        className="button button-ghost button-compact"
                        type="button"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                      <button
                        className="button button-primary button-compact"
                        type="button"
                        onClick={() => saveEdit(item.id)}
                      >
                        <Check size={14} strokeWidth={2.5} />
                        Save
                      </button>
                    </div>
                  </div>
                ) : confirmDeleteId === item.id ? (
                  <div className="prompt-config-confirm-delete">
                    <span>Delete "{item.label}"? This cannot be undone.</span>
                    <div className="prompt-config-confirm-actions">
                      <button
                        className="button button-ghost button-compact"
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="button button-danger button-compact"
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        disabled={items.length <= 1}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prompt-config-view">
                    <div className="prompt-config-view-icon">
                      {(() => {
                        const Icon = getIconByName(item.iconName ?? "SpellCheck");
                        return <Icon size={18} strokeWidth={2} />;
                      })()}
                    </div>
                    <div className="prompt-config-view-content">
                      <span className="prompt-config-label">{item.label}</span>
                      <span className="prompt-config-desc">{item.description}</span>
                      <small className="prompt-config-preview">
                        {item.systemPrompt.slice(0, previewLength)}
                        {item.systemPrompt.length > previewLength ? "…" : ""}
                      </small>
                    </div>
                    <div className="prompt-config-view-actions">
                      <button
                        className="icon-button result-icon-button"
                        type="button"
                        onClick={() => startEdit(item)}
                        title="Edit"
                        aria-label="Edit"
                      >
                        <Edit2 size={14} strokeWidth={2.2} />
                      </button>
                      <button
                        className="icon-button result-icon-button"
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        title="Delete"
                        aria-label="Delete"
                        disabled={items.length <= 1}
                      >
                        <Trash2 size={14} strokeWidth={2.2} />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="prompt-config-footer">
          <button className="button button-ghost" type="button" onClick={addNew}>
            <Plus size={16} strokeWidth={2.5} />
            Add New
          </button>
          <button
            className="button button-ghost button-compact"
            type="button"
            onClick={() => setShowRestoreConfirm(true)}
          >
            Restore Defaults
          </button>
        </div>

        {showGenerateDialog && (
          <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !isGenerating && setShowGenerateDialog(false)}>
            <div className="generate-prompt-dialog">
              <div className="generate-prompt-header">
                <h3>AI Generate Prompt</h3>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => !isGenerating && setShowGenerateDialog(false)}
                  disabled={isGenerating}
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
              <p>Describe what you want this prompt to do, and AI will generate it for you.</p>
              <input
                className="provider-name-input"
                type="text"
                placeholder="e.g., help me check grammar politely"
                value={generateDescription}
                onChange={(e) => setGenerateDescription(e.target.value)}
                disabled={isGenerating}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isGenerating && generateDescription.trim()) {
                    void addAIGenerated();
                  }
                  if (e.key === "Escape" && !isGenerating) {
                    setShowGenerateDialog(false);
                  }
                }}
                autoFocus
              />
              <div className="generate-prompt-actions">
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => !isGenerating && setShowGenerateDialog(false)}
                  disabled={isGenerating}
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => void addAIGenerated()}
                  disabled={isGenerating || !generateDescription.trim()}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={14} strokeWidth={2.5} className="spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 size={14} strokeWidth={2.5} />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showRestoreConfirm && (
          <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowRestoreConfirm(false)}>
            <div className="generate-prompt-dialog">
              <div className="generate-prompt-header">
                <h3>Restore Defaults?</h3>
              </div>
              <p>Restore all prompts to default? Your custom prompts will be lost.</p>
              <div className="generate-prompt-actions">
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => setShowRestoreConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => void handleRestoreDefaults()}
                >
                  Restore Defaults
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
