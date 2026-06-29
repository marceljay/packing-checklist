import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation, Trans } from 'react-i18next';
import type { TagGroup } from '../types';
import { useAppData } from '../db/store';
import {
  listCategories,
  addCategory,
  renameCategory,
  deleteCategory,
  FALLBACK_CATEGORY,
} from '../db/categories';
import TagEditorDialog from './TagEditorDialog';
import ConfirmDialog from './ConfirmDialog';
import { EditIcon, DeleteIcon } from './icons';

const GROUP_LABELS: { group: TagGroup; labelKey: string }[] = [
  { group: 'activity', labelKey: 'context.groupActivities' },
  { group: 'weather', labelKey: 'context.groupWeather' },
  { group: 'other', labelKey: 'context.groupOther' },
];

/**
 * Library-wide manager for the tag registry and categories, in one Manifest modal
 * with two tabs. Tags reuse {@link TagEditorDialog} (group / pin / rename / delete);
 * categories can be added, renamed, and deleted (items reassigned to the fallback).
 * Reads the live document so edits reflect immediately.
 */
export default function TagCategoryManager({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { tagMeta } = useAppData();
  const [tab, setTab] = useState<'tags' | 'categories'>('tags');
  const [editingTag, setEditingTag] = useState<string | null>(null);

  const [newCat, setNewCat] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // A sub-dialog (tag editor / delete confirm) owns Escape while it's open.
  const subOpen = editingTag !== null || confirmDel !== null;
  const subOpenRef = useRef(subOpen);
  subOpenRef.current = subOpen;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !subOpenRef.current) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const grouped = GROUP_LABELS.map(({ group, labelKey }) => ({
    label: t(labelKey),
    tags: tagMeta
      .filter((tm) => tm.group === group)
      .map((tm) => tm.key)
      .sort((a, b) => a.localeCompare(b)),
  })).filter((g) => g.tags.length > 0);

  const categories = listCategories();

  function commitAdd() {
    const c = newCat.trim();
    if (!c) return;
    addCategory(c);
    setNewCat('');
  }

  function commitRename(from: string) {
    renameCategory(from, renameVal);
    setRenaming(null);
    setRenameVal('');
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !subOpen) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('manager.title')}
        className="card flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden"
      >
        <div aria-hidden className="airmail h-1 w-full" />
        <div className="flex items-center justify-between gap-2 p-5 pb-0">
          <h2 className="font-display text-lg font-bold leading-tight">{t('manager.title')}</h2>
          <button className="btn-ghost px-2 py-1 text-sm" aria-label={t('common.close')} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label={t('manager.tabsAria')} className="flex gap-1 px-5 pt-3">
          {(['tags', 'categories'] as const).map((tb) => (
            <button
              key={tb}
              role="tab"
              aria-selected={tab === tb}
              onClick={() => setTab(tb)}
              className={`chip capitalize transition-colors ${
                tab === tb ? 'bg-ink text-paper-raised' : 'bg-paper-sunk text-ink-soft hover:bg-line'
              }`}
            >
              {tb === 'tags' ? t('manager.tabTags') : t('manager.tabCategories')}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === 'tags' ? (
            grouped.length === 0 ? (
              <p className="text-sm text-ink-soft">{t('manager.noTags')}</p>
            ) : (
              <div className="flex flex-col gap-4">
                {grouped.map((g) => (
                  <div key={g.label}>
                    <p className="label mb-1.5">{g.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.tags.map((k) => (
                        <button
                          key={k}
                          onClick={() => setEditingTag(k)}
                          title={t('manager.editTagTitle', { tag: k })}
                          className="chip bg-airblue-soft text-airblue transition-colors hover:bg-airblue/20"
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-ink-faint">
                  {t('manager.tagsHelp')}
                </p>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3">
              {/* Add */}
              <div className="flex gap-2">
                <input
                  className="input min-w-0 flex-1"
                  placeholder={t('manager.newCatPlaceholder')}
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitAdd();
                    }
                  }}
                  aria-label={t('manager.newCatAria')}
                />
                <button className="btn-secondary text-sm" onClick={commitAdd} disabled={!newCat.trim()}>
                  {t('manager.add')}
                </button>
              </div>

              <ul className="divide-y divide-line/60 rounded-md border border-line">
                {categories.map((c) => (
                  <li key={c} className="flex items-center gap-2 px-3 py-2 text-sm">
                    {renaming === c ? (
                      <>
                        <input
                          className="input h-8 min-w-0 flex-1 py-1"
                          value={renameVal}
                          autoFocus
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitRename(c);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setRenaming(null);
                            }
                          }}
                          aria-label={t('manager.renameAria', { cat: c })}
                        />
                        <button className="btn-secondary px-2 py-1 text-xs" onClick={() => commitRename(c)}>
                          {t('common.save')}
                        </button>
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setRenaming(null)}>
                          {t('common.cancel')}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate">{c}</span>
                        <button
                          className="btn-ghost px-1.5 py-1"
                          aria-label={t('manager.renameAria', { cat: c })}
                          onClick={() => {
                            setRenaming(c);
                            setRenameVal(c);
                          }}
                        >
                          <EditIcon />
                        </button>
                        {c !== FALLBACK_CATEGORY && (
                          <button
                            className="btn-danger px-1.5 py-1"
                            aria-label={t('manager.deleteAria', { cat: c })}
                            onClick={() => setConfirmDel(c)}
                          >
                            <DeleteIcon />
                          </button>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-faint">
                {t('manager.catHelp', { fallback: FALLBACK_CATEGORY })}
              </p>
            </div>
          )}
        </div>
      </div>

      {editingTag && <TagEditorDialog tag={editingTag} onClose={() => setEditingTag(null)} />}

      {confirmDel && (
        <ConfirmDialog
          title={t('manager.deleteCatTitle', { cat: confirmDel })}
          confirmLabel={t('manager.deleteCatConfirm')}
          tone="danger"
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            deleteCategory(confirmDel);
            setConfirmDel(null);
          }}
        >
          <p>
            <Trans i18nKey="manager.deleteCatBody" values={{ cat: confirmDel, fallback: FALLBACK_CATEGORY }} components={{ strong: <strong /> }} />
          </p>
        </ConfirmDialog>
      )}
    </div>,
    document.body,
  );
}
