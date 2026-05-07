import { useEffect, useMemo, useState } from "react";
import { testProvider } from "../api";
import { createProvider, loadPromptActions, loadSettings, saveSettings } from "../storage";
import type { PromptAction } from "../prompts";
import type { ProviderConfig, Settings } from "../types";

export type ConnectionCheck = {
  status: "checking" | "ok" | "error";
  message: string;
};

export function useProviderSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [promptActions, setPromptActions] = useState<PromptAction[]>(() => loadPromptActions());
  const [connectionChecks, setConnectionChecks] = useState<Record<string, ConnectionCheck>>({});

  const activeProvider = useMemo(
    () =>
      settings.providers.find((provider) => provider.id === settings.activeProviderId) ??
      settings.providers.find((provider) => provider.id === settings.defaultProviderId) ??
      settings.providers[0],
    [settings],
  );

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  function setActiveProvider(providerId: string) {
    setSettings((current) => ({ ...current, activeProviderId: providerId }));
  }

  function setDefaultProvider(providerId: string) {
    setSettings((current) => ({ ...current, defaultProviderId: providerId }));
  }

  function addProvider() {
    setSettings((current) => {
      const provider = createProvider(current.providers.length + 1);
      return {
        ...current,
        providers: [...current.providers, provider],
        activeProviderId: provider.id,
      };
    });
  }

  function clearConnectionCheck(providerId: string) {
    setConnectionChecks((current) => {
      const next = { ...current };
      delete next[providerId];
      return next;
    });
  }

  function updateProvider(providerId: string, patch: Partial<ProviderConfig>) {
    setSettings((current) => ({
      ...current,
      providers: current.providers.map((provider) =>
        provider.id === providerId ? { ...provider, ...patch } : provider,
      ),
    }));
    clearConnectionCheck(providerId);
  }

  function removeProvider(providerId: string) {
    setSettings((current) => {
      if (current.providers.length <= 1) {
        return current;
      }
      const providers = current.providers.filter((provider) => provider.id !== providerId);
      const defaultProviderId =
        current.defaultProviderId === providerId ? providers[0].id : current.defaultProviderId;
      const activeProviderId =
        current.activeProviderId === providerId ? defaultProviderId : current.activeProviderId;
      return { providers, defaultProviderId, activeProviderId };
    });
    clearConnectionCheck(providerId);
  }

  async function handleTestProvider(provider: ProviderConfig) {
    setConnectionChecks((current) => ({
      ...current,
      [provider.id]: { status: "checking", message: "Checking..." },
    }));
    try {
      const message = await testProvider(provider);
      setConnectionChecks((current) => ({
        ...current,
        [provider.id]: { status: "ok", message },
      }));
    } catch (error) {
      setConnectionChecks((current) => ({
        ...current,
        [provider.id]: {
          status: "error",
          message: error instanceof Error ? error.message : "Connection failed.",
        },
      }));
    }
  }

  return {
    settings,
    promptActions,
    setPromptActions,
    connectionChecks,
    activeProvider,
    addProvider,
    updateProvider,
    removeProvider,
    setActiveProvider,
    setDefaultProvider,
    handleTestProvider,
  };
}
