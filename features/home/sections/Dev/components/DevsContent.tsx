/**
 * DesarrolladoresContent — RSC
 *
 * Exports four static tab-panel components (pure HTML, zero JS).
 * Rendered server-side and passed as children/props to the DesarrolladoresShell
 * client component, so they never enter the JS bundle.
 */
import type { Dictionary } from '@/types/i18n';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Tab3Client } from './DevTab3Client';

/* ── Tab 0: Solidity vs Scrypto ────────────────────────────── */
export function DevTab0({ t }: { t: Dictionary }) {
  const tab = t.devs.tab0;
  return (
    <div className="flex flex-col gap-6">

      {/* Zona Superior: Bloques de Código */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

        {/* Solidity */}
        <div className="flex flex-col h-full">
          <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 font-semibold px-4 py-3 rounded-t-xl text-sm flex items-center gap-2">
            <span className="size-2 rounded-full bg-red-500" />
            {tab.solLabel}
          </div>
          <div className="bg-[var(--code-bg)] border border-[var(--color-card-border)] border-t-0 rounded-b-xl p-6 font-mono text-sm overflow-x-auto flex-1 shadow-sm text-[var(--code-punct)]">
            <span className="text-[var(--code-keyword)]">contract</span> <span className="text-[var(--code-type)]">VulnerableBank</span> {'{'}<br />
            &nbsp;&nbsp;<span className="text-[var(--code-keyword)]">mapping</span>(<span className="text-[var(--code-type)]">address</span> =&gt; <span className="text-[var(--code-type)]">uint256</span>) <span className="text-[var(--code-keyword)]">public</span> balances;<br /><br />

            &nbsp;&nbsp;<span className="text-[var(--code-keyword)]">function</span> <span className="text-[var(--code-keyword)]">withdraw</span>(<span className="text-[var(--code-type)]">uint256</span> amount) <span className="text-[var(--code-keyword)]">public</span> {'{'}<br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-comment)]">{'// '} {tab.solComment1}</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-keyword)]">require</span>(balances[msg.sender] &gt;= amount, <span className="text-[var(--code-string)]">&quot;No balance&quot;</span>);<br /><br />

            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-comment)]">{'// '} {tab.solComment2}</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;(<span className="text-[var(--code-type)]">bool</span> success, ) = msg.sender.<span className="text-[var(--code-keyword)]">call</span>{'{value: amount}'}(<span className="text-[var(--code-string)]">&quot;&quot;</span>);<br /><br />

            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-comment)]">{'// '} {tab.solComment3}</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;balances[msg.sender] -= amount;<br />
            &nbsp;&nbsp;{'}'}<br />
            {'}'}
          </div>
        </div>

        {/* Scrypto */}
        <div className="flex flex-col h-full">
          <div className="bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-text-main)] font-semibold px-4 py-3 rounded-t-xl text-sm flex items-center gap-2">
            <span className="size-2 rounded-full bg-[var(--color-accent)]" />
            {tab.scrLabel}
          </div>
          <div className="bg-[var(--code-bg)] border border-[var(--color-card-border)] border-t-0 rounded-b-xl p-6 font-mono text-sm overflow-x-auto flex-1 shadow-sm text-[var(--code-punct)]">
            <span className="text-[var(--code-keyword)]">use</span> scrypto::prelude::*;<br /><br />

            <span className="text-[var(--code-keyword)]">#[blueprint]</span><br />
            <span className="text-[var(--code-keyword)]">mod</span> <span className="text-[var(--code-type)]">bank_module</span> {'{'}<br />
            &nbsp;&nbsp;<span className="text-[var(--code-keyword)]">struct</span> <span className="text-[var(--code-type)]">SecureBank</span> {'{'}<br />
            &nbsp;&nbsp;&nbsp;&nbsp;vault: <span className="text-[var(--code-type)]">Vault</span>,<br />
            &nbsp;&nbsp;{'}'}<br /><br />

            &nbsp;&nbsp;<span className="text-[var(--code-keyword)]">impl</span> <span className="text-[var(--code-type)]">SecureBank</span> {'{'}<br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-keyword)]">pub fn</span> <span className="text-[var(--code-keyword)]">withdraw</span>({'&'}<span className="text-[var(--code-keyword)]">mut self</span>, amount: <span className="text-[var(--code-type)]">Decimal</span>) -&gt; <span className="text-[var(--code-type)]">Bucket</span> {'{'}<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-comment)]">{'// '} {tab.scrComment1}</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-keyword)]">let</span> tokens_withdrawn: <span className="text-[var(--code-type)]">Bucket</span> = <span className="text-[var(--code-keyword)]">self</span>.vault.<span className="text-[var(--code-keyword)]">take</span>(amount);<br /><br />

            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-comment)]">{'// '} {tab.scrComment2}</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;tokens_withdrawn<br />
            &nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br />
            &nbsp;&nbsp;{'}'}<br />
            {'}'}
          </div>
        </div>

      </div>

      {/* Zona Inferior: Footer con Estadísticas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Stat Solidity */}
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-start gap-3 shadow-sm">
          <AlertTriangle className="size-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300 font-medium leading-relaxed">
            {tab.solStat}
          </p>
        </div>

        {/* Stat Scrypto */}
        <div className="p-4 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-xl flex items-start gap-3 shadow-sm">
          <CheckCircle2 className="size-5 text-[var(--color-accent)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--color-text-main)] font-medium leading-relaxed">
            {tab.scrStat}
          </p>
        </div>
      </div>

    </div>
  );
}

/* ── Tab 1: Liquidity Pool Blueprint ─────────────────────────────────────── */
export function DevTab1({ t }: { t: Dictionary }) {
  const tab = t.devs.tab1;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-[var(--code-bg)] border border-[var(--color-card-border)] rounded-xl p-6 font-mono text-sm overflow-x-auto shadow-sm text-[var(--code-punct)]">
        <span className="text-[var(--code-keyword)]">#[blueprint]</span><br />
        <span className="text-[var(--code-keyword)]">mod</span> <span className="text-[var(--code-type)]">LiquidityPool</span> {'{'}<br />
        &nbsp;&nbsp;<span className="text-[var(--code-keyword)]">struct</span> <span className="text-[var(--code-type)]">LiquidityPool</span> {'{'}<br />
        &nbsp;&nbsp;&nbsp;&nbsp;vault_a: <span className="text-[var(--code-type)]">Vault</span>, <span className="text-[var(--code-comment)]">{'// '}{tab.commentVaults}</span><br />
        &nbsp;&nbsp;&nbsp;&nbsp;vault_b: <span className="text-[var(--code-type)]">Vault</span>,<br />
        &nbsp;&nbsp;&nbsp;&nbsp;lp_resource: <span className="text-[var(--code-type)]">ResourceManager</span>,<br />
        &nbsp;&nbsp;{'}'}<br /><br />
        &nbsp;&nbsp;<span className="text-[var(--code-keyword)]">impl</span> <span className="text-[var(--code-type)]">LiquidityPool</span> {'{'}<br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-keyword)]">pub fn</span> <span className="text-[var(--code-keyword)]">swap</span>({'&'}<span className="text-[var(--code-keyword)]">mut self</span>, input: <span className="text-[var(--code-type)]">Bucket</span>) -&gt; <span className="text-[var(--code-type)]">Bucket</span> {'{'}<br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-comment)]">{'// '}{tab.commentSwap}</span><br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-keyword)]">let</span> out_amount = <span className="text-[var(--code-keyword)]">self</span>.<span className="text-[var(--code-keyword)]">calculate_output</span>(input.<span className="text-[var(--code-keyword)]">amount</span>());<br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-keyword)]">self</span>.vault_a.<span className="text-[var(--code-keyword)]">put</span>(input);<br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-keyword)]">self</span>.vault_b.<span className="text-[var(--code-keyword)]">take</span>(out_amount)<br />
        &nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br />
        &nbsp;&nbsp;{'}'}<br />
        {'}'}<br /><br />
        <span className="text-[var(--code-comment)]">{'// '}{tab.commentInstantiate}</span><br />
        <span className="text-[var(--code-keyword)]">let</span> pool = <span className="text-[var(--code-type)]">LiquidityPool</span>::<span className="text-[var(--code-keyword)]">instantiate</span>(vault_usdc, vault_xrd);
      </div>
      <div className="flex flex-col justify-center gap-6">
        {tab.cards.map((card) => (
          <div key={card.title} className="bg-[var(--color-bg)] border border-[var(--color-card-border)] p-6 rounded-xl shadow-sm">
            <h3 className="text-[var(--color-text-main)] font-bold mb-2 text-lg">{card.title}</h3>
            <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tab 2: Transaction Manifest ─────────────────────────────────────────── */
export function DevTab2({ t }: { t: Dictionary }) {
  const tab = t.devs.tab2;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">

      {/* Zona Izquierda (Ocupa 2/3 del espacio): Bloque de Código RTM */}
      <div className="lg:col-span-2 flex flex-col w-full shadow-sm rounded-xl">
        {/* Cabecera del archivo tipo editor */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-card-border)] border-b-0 px-4 py-3 rounded-t-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] font-mono text-xs">
            <svg className="size-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            swap_and_deposit.rtm
          </div>
          <span className="text-xs bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 px-2 py-0.5 rounded-full font-semibold hidden sm:block">
            Radix Transaction Manifest
          </span>
        </div>

        {/* Cuerpo del código */}
        <div className="bg-[var(--code-bg)] border border-[var(--color-card-border)] rounded-b-xl p-6 font-mono text-sm overflow-x-auto text-[var(--code-punct)]">
          <span className="text-[var(--code-comment)]">{'// '} {tab.comment1}</span><br />
          <span className="text-[var(--code-comment)]">{'// '} {tab.comment2}</span><br /><br />

          <span className="text-[var(--code-keyword)] font-bold">CALL_METHOD</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">Address</span>(<span className="text-[var(--code-string)]">&quot;account_rdx1_BankA_Treasury&quot;</span>)<br />
          &nbsp;&nbsp;<span className="text-[var(--code-string)]">&quot;withdraw&quot;</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">Address</span>(<span className="text-[var(--code-string)]">&quot;resource_rdx1_CBDC_EUR&quot;</span>)<br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">Decimal</span>(<span className="text-[var(--code-string)]">&quot;10000000&quot;</span>);<br /><br />

          <span className="text-[var(--code-keyword)] font-bold">TAKE_ALL_FROM_WORKTOP</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">Address</span>(<span className="text-[var(--code-string)]">&quot;resource_rdx1_CBDC_EUR&quot;</span>)<br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">Bucket</span>(<span className="text-[var(--code-string)]">&quot;payment_bucket&quot;</span>);<br /><br />

          <span className="text-[var(--code-keyword)] font-bold">CALL_METHOD</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">Address</span>(<span className="text-[var(--code-string)]">&quot;component_rdx1_DvP_Settlement&quot;</span>)<br />
          &nbsp;&nbsp;<span className="text-[var(--code-string)]">&quot;atomic_swap&quot;</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">Bucket</span>(<span className="text-[var(--code-string)]">&quot;payment_bucket&quot;</span>);<br /><br />

          <span className="text-[var(--code-keyword)] font-bold">CALL_METHOD</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">Address</span>(<span className="text-[var(--code-string)]">&quot;account_rdx1_BankA_Treasury&quot;</span>)<br />
          &nbsp;&nbsp;<span className="text-[var(--code-string)]">&quot;deposit_batch&quot;</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">Expression</span>(<span className="text-[var(--code-string)]">&quot;ENTIRE_WORKTOP&quot;</span>);
        </div>
      </div>

      {/* Zona Derecha (Ocupa 1/3 del espacio): Cajas centradas verticalmente */}
      <div className="lg:col-span-1 flex flex-col gap-4 justify-center">
        {tab.tags.map((tag: string, i: number) => {
          // Asignar colores dinámicos
          const colorClass =
            i === 0 ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/5 border-[var(--color-accent)]/20' :
              i === 1 ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/5 border-[var(--color-primary)]/20' :
                'text-[var(--color-secondary)] bg-[var(--color-secondary)]/5 border-[var(--color-secondary)]/20';

          return (
            <div key={tag} className={`p-5 border rounded-xl flex items-center gap-4 shadow-sm transition-transform hover:-translate-y-1 ${colorClass}`}>
              <CheckCircle2 className="size-6 shrink-0" />
              <span className="text-sm font-semibold leading-tight">{tag}</span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
/* ── Tab 3: Tools & SDKs ─────────────────────────────────────────────────── */
export function DevTab3({ t }: { t: Dictionary }) {
  // Pasamos el diccionario al cliente para que maneje la interactividad
  return <Tab3Client tab={t.devs.tab3} />;
}
