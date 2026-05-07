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
import { useEffect, useState } from "react";
import { ThemeSelector } from "./ThemeSelector";
import { createPromptAction, defaultPromptActions } from "../storage";
import type { PromptAction } from "../prompts";
import type { ProviderConfig, Settings } from "../types";

export type ConnectionCheck = {
  status: "checking" | "ok" | "error";
  message: string;
};

type ConfigTab = "provider" | "prompts" | "settings";

type ConfigPanelProps = {
  activeTab: ConfigTab;
  connectionChecks: Record<string, ConnectionCheck>;
  settings: Settings;
  promptActions: PromptAction[];
  darkMode: "light" | "dark" | "system";
  setDarkMode: (mode: "light" | "dark" | "system") => void;
  onTabChange: (tab: ConfigTab | null) => void;
  onAddProvider: () => void;
  onRemoveProvider: (providerId: string) => void;
  onSetActiveProvider: (providerId: string) => void;
  onSetDefaultProvider: (providerId: string) => void;
  onTestProvider: (provider: ProviderConfig) => void;
  onUpdateProvider: (providerId: string, patch: Partial<ProviderConfig>) => void;
  onGeneratePrompt: (description: string) => Promise<string>;
  onSavePromptActions: (actions: PromptAction[]) => void;
};

export function ConfigPanel({
  activeTab,
  connectionChecks,
  settings,
  promptActions,
  darkMode,
  setDarkMode,
  onTabChange,
  onAddProvider,
  onRemoveProvider,
  onSetActiveProvider,
  onSetDefaultProvider,
  onTestProvider,
  onUpdateProvider,
  onGeneratePrompt,
  onSavePromptActions,
}: ConfigPanelProps) {
  const [localActions, setLocalActions] = useState(promptActions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<
    { mode: "view" } | { mode: "edit"; label: string; shortLabel: string; systemPrompt: string; iconName: string }
  >({ mode: "view" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateDescription, setGenerateDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  useEffect(() => {
    setLocalActions(promptActions);
  }, [promptActions]);

  const tabs: { id: ConfigTab; label: string }[] = [
    { id: "settings", label: "Settings" },
    { id: "provider", label: "Provider" },
    { id: "prompts", label: "Prompts" },
  ];

  const ICON_OPTIONS = [
    { name: "SpellCheck", icon: SpellCheck },
    { name: "Languages", icon: Languages },
    { name: "BookOpen", icon: BookOpen },
    { name: "PenTool", icon: PenTool },
    { name: "Wand2", icon: Wand2 },
    { name: "MessageSquare", icon: MessageSquare },
  ];

  const SYSTEM_PROMPT_TEMPLATES = [
    { label: "纠正语法", prompt: "You are an English teacher. Correct the grammar of the following text without changing its meaning. Output only the corrected text:\n\n" },
    { label: "翻译英文", prompt: "You are a translator. Translate the following Chinese text to English. Output only the translation:\n\n" },
    { label: "翻译中文", prompt: "You are a translator. Translate the following English text to Chinese. Output only the translation:\n\n" },
    { label: "解释意思", prompt: "You are an English teacher. Explain the meaning of the following text in Chinese, including key vocabulary and grammar points:\n\n" },
    { label: "改写润色", prompt: "You are a writing assistant. Rewrite the following text to make it more polished, natural, and well-structured while keeping the same meaning:\n\n" },
    { label: "空白", prompt: "You are a helpful assistant. " },
  ];

  function getIconByName(name: string) {
    return ICON_OPTIONS.find((o) => o.name === name)?.icon ?? SpellCheck;
  }

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
    setLocalActions((current) =>
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
    cancelEdit();
  }

  function addNew() {
    const newAction = createPromptAction();
    setLocalActions((current) => [...current, newAction]);
    startEdit(newAction);
  }

  function deleteItem(id: string) {
    if (localActions.length <= 1) return;
    setLocalActions((current) => current.filter((item) => item.id !== id));
    setConfirmDeleteId(null);
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
      setLocalActions((current) => [...current, newAction]);
      setShowGenerateDialog(false);
      setGenerateDescription("");
      startEdit(newAction);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleRestoreDefaults() {
    setLocalActions(defaultPromptActions);
    onSavePromptActions(defaultPromptActions);
    setShowRestoreConfirm(false);
  }

  function handleSaveAndClose() {
    onSavePromptActions(localActions);
    onTabChange(null);
  }

  const previewLength = 80;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onTabChange(null)}>
      <section className="provider-panel config-panel" role="dialog" aria-modal="true">
        <header className="provider-panel-header">
          <div className="config-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`config-tab ${activeTab === tab.id ? "config-tab--active" : ""}`}
                type="button"
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button className="icon-button" type="button" onClick={() => onTabChange(null)} title="Close" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="config-content">
          {activeTab === "provider" && (
            <div className="provider-tab-content">
              <div className="provider-default-row">
                <label>
                  <span>Default provider</span>
                  <select value={settings.defaultProviderId} onChange={(event) => onSetDefaultProvider(event.target.value)}>
                    {settings.providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button button-ghost" type="button" onClick={onAddProvider}>
                  Add Provider
                </button>
              </div>

              <div className="provider-list">
                {settings.providers.map((provider) => {
                  const check = connectionChecks[provider.id];
                  return (
                    <article className="provider-card" key={provider.id}>
                      <div className="provider-card-header">
                        <input
                          aria-label="Provider name"
                          className="provider-name-input"
                          value={provider.name}
                          onChange={(event) => onUpdateProvider(provider.id, { name: event.target.value })}
                        />
                        <div className="provider-card-actions">
                          {provider.id === settings.defaultProviderId ? <span className="provider-pill">Default</span> : null}
                          {provider.id === settings.activeProviderId ? (
                            <span className="provider-pill provider-pill--active">Active</span>
                          ) : (
                            <button className="button button-ghost button-compact" type="button" onClick={() => onSetActiveProvider(provider.id)}>
                              Use
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="prompt-template-select">
                        <label>
                          <span>Base URL</span>
                          <input
                            type="url"
                            value={provider.baseUrl}
                            onChange={(event) => onUpdateProvider(provider.id, { baseUrl: event.target.value })}
                            placeholder="https://api.openai.com/v1 or http://localhost:8099/v1"
                          />
                        </label>
                        <label>
                          <span>Model</span>
                          <input
                            value={provider.model}
                            onChange={(event) => onUpdateProvider(provider.id, { model: event.target.value })}
                            placeholder="Qwen3.6-35B-A3B-4bit"
                          />
                        </label>
                        <label>
                          <span>API Key</span>
                          <input
                            type="password"
                            value={provider.apiKey}
                            onChange={(event) => onUpdateProvider(provider.id, { apiKey: event.target.value })}
                            placeholder="Optional for localhost"
                            autoComplete="off"
                          />
                        </label>
                      </div>

                      <div className="provider-test-row">
                        <button
                          className="button button-primary button-compact"
                          type="button"
                          disabled={check?.status === "checking"}
                          onClick={() => onTestProvider(provider)}
                        >
                          {check?.status === "checking" ? "Checking" : "Test"}
                        </button>
                        <button
                          className="button button-danger button-compact"
                          type="button"
                          disabled={settings.providers.length <= 1}
                          onClick={() => onRemoveProvider(provider.id)}
                        >
                          Delete
                        </button>
                        {check ? (
                          <span className={`check-message check-message--${check.status}`}>{check.message}</span>
                        ) : (
                          <span className="check-message">Not tested</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "prompts" && (
            <div className="prompts-tab-content">
              <div className="prompt-config-list">
                {localActions.map((item) => {
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
                                  setEditState((s) => (s.mode === "edit" ? { ...s, label: e.target.value } : s))
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
                                  setEditState((s) => (s.mode === "edit" ? { ...s, shortLabel: e.target.value } : s))
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
                                  const selected = editState.mode === "edit" && editState.iconName === opt.name;
                                  return (
                                    <button
                                      key={opt.name}
                                      type="button"
                                      className={`prompt-icon-option ${selected ? "prompt-icon-option--selected" : ""}`}
                                      onClick={() =>
                                        setEditState((s) => (s.mode === "edit" ? { ...s, iconName: opt.name } : s))
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
                                className="prompt-template-select"
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
                              value={editState.mode === "edit" ? editState.systemPrompt : ""}
                              onChange={(e) =>
                                setEditState((s) => (s.mode === "edit" ? { ...s, systemPrompt: e.target.value } : s))
                              }
                              rows={4}
                            />
                          </label>

                          <div className="prompt-config-edit-actions">
                            <button className="button button-ghost button-compact" type="button" onClick={cancelEdit}>
                              Cancel
                            </button>
                            <button className="button button-primary button-compact" type="button" onClick={() => saveEdit(item.id)}>
                              <Check size={14} strokeWidth={2.5} />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : confirmDeleteId === item.id ? (
                        <div className="prompt-config-confirm-delete">
                          <span>Delete "{item.label}"? This cannot be undone.</span>
                          <div className="prompt-config-confirm-actions">
                            <button className="button button-ghost button-compact" type="button" onClick={() => setConfirmDeleteId(null)}>
                              Cancel
                            </button>
                            <button
                              className="button button-danger button-compact"
                              type="button"
                              onClick={() => deleteItem(item.id)}
                              disabled={localActions.length <= 1}
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
                            <button className="icon-button result-icon-button" type="button" onClick={() => startEdit(item)} title="Edit" aria-label="Edit">
                              <Edit2 size={14} strokeWidth={2.2} />
                            </button>
                            <button
                              className="icon-button result-icon-button"
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              title="Delete"
                              aria-label="Delete"
                              disabled={localActions.length <= 1}
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
                {showRestoreConfirm ? (
                  <div className="prompt-config-confirm-footer">
                    <span>Restore all prompts to defaults?</span>
                    <div className="prompt-config-confirm-actions">
                      <button className="button button-ghost button-compact" type="button" onClick={() => setShowRestoreConfirm(false)}>
                        Cancel
                      </button>
                      <button className="button button-danger button-compact" type="button" onClick={() => void handleRestoreDefaults()}>
                        Restore
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="button button-ghost button-compact" type="button" onClick={() => setShowRestoreConfirm(true)}>
                    Restore Defaults
                  </button>
                )}
                <button className="button button-ghost button-compact" type="button" onClick={() => setShowGenerateDialog(true)} title="AI Generate new prompt">
                  <Wand2 size={14} strokeWidth={2.5} />
                  AI Generate
                </button>
              </div>

              {showGenerateDialog && (
                <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !isGenerating && setShowGenerateDialog(false)}>
                  <div className="generate-prompt-dialog">
                    <div className="generate-prompt-header">
                      <h3>AI Generate Prompt</h3>
                      <button className="icon-button" type="button" onClick={() => !isGenerating && setShowGenerateDialog(false)} disabled={isGenerating}>
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
                      <button className="button button-ghost" type="button" onClick={() => !isGenerating && setShowGenerateDialog(false)} disabled={isGenerating}>
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
            </div>
          )}

          {activeTab === "settings" && (
            <div className="settings-tab-content">
              <div className="settings-section">
                <h3>Appearance</h3>
                <ThemeSelector value={darkMode} onChange={setDarkMode} />
              </div>
            </div>
          )}
        </div>

        <div className="config-footer">
          <button className="button button-primary" type="button" onClick={handleSaveAndClose}>
            保存并关闭
          </button>
        </div>
      </section>
    </div>
  );
}
