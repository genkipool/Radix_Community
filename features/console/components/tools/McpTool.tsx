'use client';

import { useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Check, Copy, Download, ExternalLink, FileText, MessageCircleQuestion, Network, TerminalSquare } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';

/* ─── AI-client install snippets ──────────────────────────────────────────── */

interface McpClient {
  id: string;
  name: string;
  lang: 'bash' | 'json' | 'toml';
  snippet: (endpoint: string) => string;
}

const jsonSnippet = (config: Record<string, unknown>) => JSON.stringify(config, null, 2);

/** Install configuration per AI client. Notes are translated via t.mcp.clients.notes. */
const MCP_CLIENTS: McpClient[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    lang: 'bash',
    snippet: (endpoint) => `claude mcp add --transport http radix ${endpoint}`,
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop / claude.ai',
    lang: 'json',
    snippet: (endpoint) => jsonSnippet({ mcpServers: { radix: { type: 'http', url: endpoint } } }),
  },
  {
    id: 'cursor',
    name: 'Cursor',
    lang: 'json',
    snippet: (endpoint) => jsonSnippet({ mcpServers: { radix: { url: endpoint } } }),
  },
  {
    id: 'vscode',
    name: 'VS Code (Copilot)',
    lang: 'json',
    snippet: (endpoint) => jsonSnippet({ servers: { radix: { type: 'http', url: endpoint } } }),
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    lang: 'json',
    snippet: (endpoint) => jsonSnippet({ mcpServers: { radix: { serverUrl: endpoint } } }),
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    lang: 'json',
    snippet: (endpoint) => jsonSnippet({ mcpServers: { radix: { type: 'http', url: endpoint } } }),
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    lang: 'json',
    snippet: (endpoint) => jsonSnippet({ mcpServers: { radix: { type: 'http', url: endpoint } } }),
  }
];

/* ─── Terminal-styled frame ───────────────────────────────────────────────── */

function TerminalWindow({
  title,
  copyValue,
  copyLabel,
  children,
}: {
  title: string;
  copyValue?: string;
  copyLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col w-full shadow-sm rounded-xl">
      <div className="bg-[var(--color-surface)] border border-[var(--color-card-border)] border-b-0 px-4 py-3 rounded-t-xl text-sm flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)] font-mono text-xs">
          <svg className="size-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {title}
        </div>
        {copyValue && (
          <CopyButton value={copyValue} size="xs" variant="minimal" label={copyLabel} />
        )}
      </div>
      <div className="bg-[var(--code-bg)] border border-[var(--color-card-border)] rounded-b-xl p-4 font-mono text-xs leading-relaxed overflow-x-auto text-[var(--code-punct)]">
        {children}
      </div>
    </div>
  );
}

/* ─── Copy-on-click example question ──────────────────────────────────────── */

function ExampleQuestion({ question }: { question: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(question);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 rounded-xl border text-xs leading-relaxed transition-all hover:-translate-y-px"
      style={{
        background: 'var(--color-surface)',
        borderColor: copied ? 'var(--color-accent)' : 'var(--color-card-border)',
        color: 'var(--color-text-main)',
      }}
    >
      <MessageCircleQuestion className="size-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
      <span className="flex-1 min-w-0">{question}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
      ) : (
        <Copy
          className="size-3.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
          style={{ color: 'var(--color-text-muted)' }}
        />
      )}
    </button>
  );
}

/* ─── Live tool catalog (dogfoods the /api/mcp endpoint) ──────────────────── */

interface McpToolInfo {
  name: string;
  title: string;
  description: string;
}

function useMcpToolCatalog() {
  return useQuery({
    queryKey: ['mcp-tool-catalog'],
    queryFn: async (): Promise<McpToolInfo[]> => {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      if (!res.ok) throw new Error(`MCP ${res.status}`);
      const data = (await res.json()) as { result?: { tools?: McpToolInfo[] } };
      return data.result?.tools ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

/* ─── Panel ───────────────────────────────────────────────────────────────── */

export default function McpTool({ t }: ConsoleToolProps) {
  const labels = t.mcp;
  const { data: tools, isLoading, isError } = useMcpToolCatalog();

  // window.location is unavailable during SSR — resolve the origin on the client.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => '',
  );
  const endpoint = `${origin}/api/mcp`;

  const [selectedClientId, setSelectedClientId] = useState(MCP_CLIENTS[0].id);
  const selectedClient = MCP_CLIENTS.find((client) => client.id === selectedClientId) ?? MCP_CLIENTS[0];
  const clientNotes = labels.clients.notes as Record<string, string>;

  return (
    <div className="space-y-6">
      {/* ── Endpoint ── */}
      <ToolSection title={labels.endpoint.title} hint={labels.endpoint.hint}>
        <div
          className="flex items-center gap-2 p-1.5 pl-4 rounded-xl border"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}
        >
          <TerminalSquare className="size-4 shrink-0" style={{ color: 'var(--color-primary)' }} />
          <code className="flex-1 min-w-0 truncate text-sm font-mono" style={{ color: 'var(--color-text-main)' }}>
            {endpoint}
          </code>
          <CopyButton value={endpoint} size="sm" label={t.common.copy} />
        </div>
      </ToolSection>

      {/* ── Install per AI client ── */}
      <ToolSection title={labels.clients.title} hint={labels.clients.hint}>
        <div className="flex flex-wrap gap-2">
          {MCP_CLIENTS.map((client) => {
            const isSelected = client.id === selectedClientId;
            return (
              <button
                key={client.id}
                type="button"
                onClick={() => setSelectedClientId(client.id)}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border"
                style={
                  isSelected
                    ? { background: 'var(--color-primary)', color: 'var(--color-bg)', borderColor: 'transparent' }
                    : {
                        background: 'var(--color-surface)',
                        color: 'var(--color-text-muted)',
                        borderColor: 'var(--color-card-border)',
                      }
                }
              >
                {client.name}
              </button>
            );
          })}
        </div>

        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {clientNotes[selectedClient.id]}
        </p>

        <div className="relative">
          <TerminalWindow
            title={`${selectedClient.name} · ${selectedClient.lang}`}
            copyValue={selectedClient.snippet(endpoint)}
            copyLabel={t.common.copy}
          >
            <pre className="whitespace-pre-wrap break-all">
              {selectedClient.lang === 'bash' && <span className="text-[var(--color-accent)]">$ </span>}
              {selectedClient.snippet(endpoint)}
            </pre>
          </TerminalWindow>
        </div>
      </ToolSection>

      {/* ── Skill file ── */}
      <ToolSection title={labels.skills.title} hint={labels.skills.hint}>
        <div className="flex flex-wrap gap-3">
          {/* Plain anchors: these hit an API route (file download), not a page */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/mcp/skills?download=true"
            className="inline-flex items-center gap-2 px-5 h-10 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95"
          >
            <Download className="size-4" />
            {labels.skills.download}
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/mcp/skills"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 h-10 rounded-full font-bold text-sm border transition-all hover:opacity-80"
            style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
          >
            <FileText className="size-4" />
            {labels.skills.view}
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </ToolSection>

      {/* ── Example questions ── */}
      <ToolSection title={labels.examples.title} hint={labels.examples.hint}>
        <div className="space-y-5">
          {labels.examples.groups.map((group) => (
            <div key={group.title} className="space-y-2">
              <h4
                className="text-[11px] font-black uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {group.title}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {group.items.map((question) => (
                  <ExampleQuestion key={question} question={question} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Mainnet vs Stokenet callout */}
        <div
          className="flex gap-3 p-4 rounded-xl border"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}
        >
          <Network className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
          <div className="space-y-1 min-w-0">
            <h4 className="text-xs font-bold" style={{ color: 'var(--color-text-main)' }}>
              {labels.examples.network.title}
            </h4>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {labels.examples.network.body}
            </p>
          </div>
        </div>
      </ToolSection>

      {/* ── Live capability catalog ── */}
      <ToolSection title={labels.capabilities.title} hint={labels.capabilities.hint}>
        <TerminalWindow title="radix-community · tools/list">
          <p>
            <span className="text-[var(--color-accent)]">❯</span>{' '}
            <span className="text-[var(--color-text-muted)]">POST /api/mcp</span>{' '}
            <span className="text-[var(--color-text-muted)] opacity-70">{'{ "method": "tools/list" }'}</span>
          </p>
          {isLoading && <p className="mt-3 animate-pulse text-[var(--color-text-muted)]">{labels.capabilities.loading}</p>}
          {isError && <p className="mt-3 text-[var(--color-close-hover)]">{labels.capabilities.error}</p>}
          {tools && (
            <div className="mt-3 space-y-3">
              <p className="text-[var(--color-text-muted)]">
                {tools.length} {labels.capabilities.count}
              </p>
              {tools.map((tool) => (
                <div key={tool.name}>
                  <p>
                    <Bot className="inline size-3.5 mr-1.5 -mt-0.5 text-[var(--color-primary)]" />
                    <span className="font-bold text-[var(--color-secondary)]">{tool.name}</span>
                    <span className="text-[var(--color-text-muted)]"> — {tool.title}</span>
                  </p>
                  <p className="pl-5 text-[var(--color-text-muted)]">{tool.description}</p>
                </div>
              ))}
            </div>
          )}
        </TerminalWindow>
        <p className="text-[11px] leading-relaxed italic" style={{ color: 'var(--color-text-muted)' }}>
          {labels.capabilities.note}
        </p>
      </ToolSection>
    </div>
  );
}
