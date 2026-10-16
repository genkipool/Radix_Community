'use client';

import { useState, type ReactNode } from 'react';
import { FileSpreadsheet, Users } from 'lucide-react';

import type { ConsoleDictionary } from '../../types/i18n.types';
import { FileDropzone } from '../shared/FileDropzone';
import { OptionButtons } from '../shared/OptionButtons';
import { ToolSection } from '../shared/ToolSection';
import { AddressField, TextAreaField } from '../shared/fields';
import { HolderDistributionPanel } from './HolderDistributionPanel';
import { RecipientRows } from './RecipientRows';

type ListSource = 'csv' | 'holders';

interface RecipientListInputProps {
  t: ConsoleDictionary;
  title: string;
  hint?: string;
  csv: string;
  onCsvChange: (csv: string) => void;
  defaultResource: string;
  onDefaultResourceChange: (resource: string) => void;
}

/**
 * Where a recipient list comes from: a CSV pasted or uploaded, or a split
 * among the holders of a token. Either way it ends up as the CSV, so the
 * holder split can be reviewed and edited before anything is signed. It is
 * its own box, with the holder split's buttons under it.
 */
export function RecipientListInput({ t, title, hint, csv, onCsvChange, defaultResource, onDefaultResourceChange }: RecipientListInputProps) {
  const labels = t.bulkSend;
  const [source, setSource] = useState<ListSource>('csv');
  const [file, setFile] = useState<File | null>(null);
  // Fields by default; the raw text is there for pasting a long list.
  const [textMode, setTextMode] = useState(false);

  const onFile = async (picked: File | null) => {
    setFile(picked);
    if (picked) onCsvChange(await picked.text());
  };

  const toggle = (
    <OptionButtons<ListSource>
      layout="grid"
      className="sm:grid-cols-2"
      size="sm"
      options={[
        { value: 'csv', label: t.holders.sourceCsv, description: t.holders.sourceCsvHint, icon: <FileSpreadsheet className="size-4" /> },
        { value: 'holders', label: t.holders.sourceHolders, description: t.holders.sourceHoldersHint, icon: <Users className="size-4" /> },
      ]}
      value={source}
      onChange={setSource}
    />
  );
  const section = (body: ReactNode) => (
    <ToolSection title={title} hint={hint}>
      {toggle}
      {body}
    </ToolSection>
  );

  if (source === 'holders') {
    return (
      <HolderDistributionPanel
        t={t}
        onUse={(next) => {
          setFile(null);
          onCsvChange(next);
          setSource('csv');
        }}
        frame={(body, actions) => (
          <>
            {section(body)}
            {actions}
          </>
        )}
      />
    );
  }

  // The token first: the usual airdrop is one token to many, written as
  // `account,amount` lines that only make sense once it is chosen. The file
  // and the list below are two ways of filling in the same thing.
  return section(
    <>
      <AddressField
        categories={['resource']}
        pickerSendableOnly
        label={labels.defaultResource}
        hint={labels.defaultResourceHint}
        value={defaultResource}
        onChange={onDefaultResourceChange}
        placeholder={t.buildManifest.fieldPlaceholders.resource}
      />
      <FileDropzone extension=".csv" accept=".csv,text/csv,text/plain" label={labels.file} prompt={labels.filePrompt} file={file} onFile={onFile} />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {labels.csvLabel}
          </span>
          <button
            type="button"
            onClick={() => setTextMode((v) => !v)}
            className="text-xs font-bold hover:opacity-70"
            style={{ color: 'var(--color-primary)' }}
          >
            {textMode ? labels.fieldsMode : labels.textMode}
          </button>
        </div>
        {textMode ? (
          <TextAreaField hint={labels.csvHint} value={csv} onChange={onCsvChange} rows={8} mono placeholder={labels.csvPlaceholder} />
        ) : (
          <>
            <RecipientRows csv={csv} onCsvChange={onCsvChange} defaultResource={defaultResource} />
            <p className="text-[11px] leading-tight" style={{ color: 'var(--color-text-muted)' }}>
              {labels.rowsHint}
            </p>
          </>
        )}
      </div>
    </>,
  );
}
