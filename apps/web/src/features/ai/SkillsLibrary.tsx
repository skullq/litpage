// Library > Skills: "All skills", "Enabled for my account", and "Disabled / Discover".
// Supports creating, editing (via modal or page), deleting (with confirmation),
// and toggling between Enabled and Disabled.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import { openPage } from '../../lib/router.ts';
import { useSession } from '../../lib/store/session.ts';
import { useUI } from '../../lib/store/ui.ts';
import { Icon } from '../../components/Icon.tsx';
import { Modal } from '../../components/Modal.tsx';
import { openMenu } from '../../components/Menu.tsx';
import {
  createSkill,
  deleteSkill,
  setSkillAutomatic,
  setSkillEnabled,
  updateSkill,
  useSkills,
  type SkillInfo,
} from './aiStores.ts';
import { useAiStatus } from './aiApi.ts';

/** Global trigger to open new skill modal from anywhere (e.g. Library header button). */
let globalOpenNewSkill: (() => void) | null = null;

export function openNewSkillModal() {
  if (globalOpenNewSkill) {
    globalOpenNewSkill();
  } else {
    void createNewSkill();
  }
}

/** "New skill": fallback to creating a private skill page. */
export async function createNewSkill() {
  try {
    const r = await api<{ pageId: string }>('aiCreateSkill', { spaceId: useSession.getState().spaceId });
    void useSkills.getState().load(true);
    openPage(r.pageId);
  } catch (e) {
    useUI.getState().toast((e as Error)?.message || 'Could not create skill');
  }
}

/** "Edit skill" (selection menu / ⋮⋮ › Skills pencil): open the skill's page — built-ins become your editable copy. */
export async function editSkill(name?: string, skillId?: string) {
  const own = skillId ? useSkills.getState().enabled.find((x) => x.id === skillId && x.pageId) : undefined;
  if (own?.pageId) {
    openPage(own.pageId);
    return;
  }
  try {
    const r = await api<{ pageId: string; created: boolean }>('aiCustomizeBuiltinSkill', {
      spaceId: useSession.getState().spaceId,
      skill: name ?? skillId,
    });
    void useSkills.getState().load(true);
    openPage(r.pageId);
  } catch (e) {
    useUI.getState().toast((e as Error)?.message || 'Couldn’t open this skill');
  }
}

async function downloadSkill(s: SkillInfo) {
  try {
    const r = await api<{ filename: string; markdown: string }>('aiSkillFile', {
      spaceId: useSession.getState().spaceId,
      skillId: s.id,
    });
    const url = URL.createObjectURL(new Blob([r.markdown], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SKILL.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    useUI.getState().toast(`Downloaded ${r.filename}`);
  } catch (e) {
    useUI.getState().toast((e as Error)?.message || 'Skill download failed');
  }
}

/** Modal dialog for creating or editing a skill. */
export function SkillModal({
  open,
  onClose,
  skill,
}: {
  open: boolean;
  onClose: () => void;
  skill?: SkillInfo | null;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🧠');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (skill) {
      setName(skill.name || '');
      setIcon(skill.icon || '🧠');
      setDescription(skill.description || '');
      setInstructions(skill.instructions || '');
    } else {
      setName('');
      setIcon('🧠');
      setDescription('');
      setInstructions('');
    }
    setError(null);
  }, [skill, open]);

  const save = async () => {
    if (!name.trim()) {
      setError('Please enter a skill name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (skill) {
        await updateSkill({
          skillId: skill.id,
          name: name.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          icon,
        });
        useUI.getState().toast('Skill updated successfully.');
      } else {
        await createSkill({
          title: name.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          icon,
        });
        useUI.getState().toast('Skill created successfully.');
      }
      onClose();
    } catch (e) {
      setError((e as Error)?.message || 'Failed to save skill.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} width={540} className="nc-skill-modal">
      <div className="nc-skill-modal-content">
        <div className="nc-skill-modal-header">
          <h3>{skill ? 'Edit skill' : 'New skill'}</h3>
          <button type="button" className="nc-icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="nc-skill-modal-body lit-scroller vertical">
          {error && <div className="nc-skill-modal-error">{error}</div>}
          <div className="nc-skill-form-field">
            <label>Name</label>
            <div className="nc-skill-name-row">
              <input
                className="nc-skill-icon-input"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                title="Skill icon / emoji"
              />
              <input
                className="nc-skill-input"
                placeholder="Skill name (e.g. Cisco Validator, Summarize Meeting)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="nc-skill-form-field">
            <label>Description</label>
            <span className="nc-skill-field-hint">When should Litpage AI apply this skill?</span>
            <textarea
              className="nc-skill-textarea"
              rows={2}
              placeholder="e.g. Inspect network configuration for syntax errors, missing commands, and security gaps."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="nc-skill-form-field">
            <label>Instructions / Prompt</label>
            <span className="nc-skill-field-hint">Steps or rules AI must follow when executing this skill</span>
            <textarea
              className="nc-skill-textarea instructions"
              rows={6}
              placeholder="e.g. Analyze the provided configuration. Point out any syntax errors or unrecommended commands..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
        </div>
        <div className="nc-skill-modal-footer">
          {skill?.pageId && (
            <button
              type="button"
              className="nc-btn outline mr-auto"
              onClick={() => {
                onClose();
                openPage(skill.pageId!);
              }}
            >
              <Icon name="page" size={14} />
              <span>Open full page</span>
            </button>
          )}
          <button type="button" className="nc-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="nc-btn primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : skill ? 'Save changes' : 'Create skill'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SkillRow({
  s,
  onEdit,
  onDelete,
}: {
  s: SkillInfo;
  onEdit: (s: SkillInfo) => void;
  onDelete: (s: SkillInfo) => void;
}) {
  const [busy, setBusy] = useState(false);
  const localSkills = useAiStatus((st) => st.policy.localSkills);

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      await setSkillEnabled(s, on);
      useUI.getState().toast(on ? 'Skill enabled' : 'Skill disabled');
    } catch (e) {
      useUI.getState().toast((e as Error)?.message || 'Failed to update skill status');
    } finally {
      setBusy(false);
    }
  };

  const more = (anchor: HTMLElement) =>
    openMenu(
      anchor,
      {
        width: 240,
        sections: [
          {
            items: [
              { label: 'Edit skill', icon: 'pencilLineSmall', onSelect: () => onEdit(s) },
              {
                label: s.enabled ? 'Disable skill' : 'Enable skill',
                icon: s.enabled ? 'close' : 'check',
                onSelect: () => void toggle(!s.enabled),
              },
              ...(s.pageId ? [{ label: 'Show skill page', icon: 'page', onSelect: () => openPage(s.pageId!) }] : []),
              ...(localSkills ? [{ label: 'Download for local agent use', icon: 'download', onSelect: () => { void downloadSkill(s); } }] : []),
              {
                label: 'Delete skill',
                icon: 'trash',
                danger: true,
                onSelect: () => onDelete(s),
              },
            ],
          },
        ],
      },
      { placement: 'bottom-end' }
    );

  return (
    <div
      className={`nc-ai-skill-row ${s.enabled ? 'is-enabled' : 'is-disabled'}`}
      data-testid="ai-skill-row"
      data-skill={s.name}
    >
      <div className="nc-ai-skill-icon">
        {s.icon ? <span>{s.icon}</span> : <Icon name={s.builtin ? 'aiFace' : 'aiStepSkill'} size={18} />}
      </div>
      <div className="nc-ai-skill-main" role={s.pageId ? 'link' : undefined} onClick={() => onEdit(s)}>
        <div className="nc-ai-skill-name">
          <span className="nc-ellipsis">{s.name || 'Untitled'}</span>
          {s.builtin && <span className="nc-badge gray">Default</span>}
          <span className={`nc-badge ${s.enabled ? 'green' : 'gray'}`}>
            {s.enabled ? '✓ Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="nc-ai-skill-desc nc-ellipsis">{s.description || 'No description'}</div>
        <div className="nc-ai-skill-where">
          {s.inChat && <span>In chat</span>}
          {s.inPage && <span>In a page</span>}
          {!s.mine && !s.builtin && s.createdBy && <span>by {s.createdBy}</span>}
        </div>
      </div>
      <div className="nc-ai-skill-actions">
        {s.enabled && !s.builtin && (
          <div
            role="switch"
            aria-checked={s.automatic}
            tabIndex={0}
            className="nc-ai-skill-auto"
            data-tooltip="Let Litpage AI use this skill automatically when relevant"
            onClick={() => void setSkillAutomatic(s, !s.automatic)}
          >
            <span>Auto</span>
            <span className={`nc-ai-switch ${s.automatic ? 'on' : ''}`} aria-hidden>
              <span />
            </span>
          </div>
        )}

        {/* Enable / Disable toggle button */}
        <button
          type="button"
          className={`nc-btn small ${s.enabled ? 'outline' : 'primary'} nc-ai-skill-btn-toggle`}
          disabled={busy}
          data-testid="ai-skill-toggle-btn"
          title={s.enabled ? 'Disable this skill' : 'Enable this skill'}
          onClick={() => void toggle(!s.enabled)}
        >
          {s.enabled ? 'Disable' : 'Enable'}
        </button>

        {/* Edit button */}
        <button
          type="button"
          className="nc-btn outline small nc-ai-skill-btn-edit"
          data-testid="ai-skill-edit-btn"
          title="Edit skill"
          onClick={() => onEdit(s)}
        >
          <Icon name="pencilLineSmall" size={14} />
          <span>Edit</span>
        </button>

        {/* Delete button */}
        <button
          type="button"
          className="nc-btn outline small danger nc-ai-skill-btn-del"
          data-testid="ai-skill-delete-btn"
          title={s.builtin ? 'Disable default skill' : 'Delete skill'}
          onClick={() => onDelete(s)}
        >
          <Icon name="trash" size={14} />
        </button>

        <div role="button" aria-label="More actions" className="nc-ai-icon-btn" onClick={(e) => more(e.currentTarget)}>
          <Icon name="ellipsisSmall" size={16} />
        </div>
      </div>
    </div>
  );
}

export function SkillsTab({
  seg,
  setSeg,
}: {
  seg: 'all' | 'enabled' | 'discover';
  setSeg: (v: 'all' | 'enabled' | 'discover') => void;
}) {
  const { enabled, discover, loading, error } = useSkills();
  const [modalSkill, setModalSkill] = useState<SkillInfo | null | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<SkillInfo | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    globalOpenNewSkill = () => setModalSkill(null);
    return () => {
      globalOpenNewSkill = null;
    };
  }, []);

  useEffect(() => {
    void useSkills.getState().load(true);
  }, []);

  const allSkills = useMemo(() => {
    const map = new Map<string, SkillInfo>();
    for (const s of enabled) map.set(s.id, s);
    for (const s of discover) if (!map.has(s.id)) map.set(s.id, s);
    return Array.from(map.values());
  }, [enabled, discover]);

  let baseList: SkillInfo[];
  if (seg === 'all') baseList = allSkills;
  else if (seg === 'enabled') baseList = enabled;
  else baseList = discover;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }, [baseList, search]);

  const handleDelete = async (s: SkillInfo) => {
    setConfirmDelete(null);
    try {
      await deleteSkill(s.id);
      useUI.getState().toast('Skill deleted');
    } catch (e) {
      useUI.getState().toast((e as Error)?.message || 'Delete failed');
    }
  };

  return (
    <div className="nc-lib-skills">
      <div className="nc-lib-skills-header">
        <div className="nc-lib-seg" role="tablist" aria-label="Skill library sections">
          <div
            role="tab"
            aria-selected={seg === 'all'}
            className={`nc-lib-seg-item ${seg === 'all' ? 'selected' : ''}`}
            onClick={() => setSeg('all')}
          >
            All skills ({allSkills.length})
          </div>
          <div
            role="tab"
            aria-selected={seg === 'enabled'}
            className={`nc-lib-seg-item ${seg === 'enabled' ? 'selected' : ''}`}
            onClick={() => setSeg('enabled')}
          >
            Enabled ({enabled.length})
          </div>
          <div
            role="tab"
            aria-selected={seg === 'discover'}
            className={`nc-lib-seg-item ${seg === 'discover' ? 'selected' : ''}`}
            onClick={() => setSeg('discover')}
          >
            Disabled / Discover ({discover.length})
          </div>
        </div>

        <div className="nc-lib-skills-toolbar">
          <div className="nc-lib-search-box">
            <Icon name="search" size={14} />
            <input
              type="text"
              placeholder="Search skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <span role="button" onClick={() => setSearch('')} className="nc-search-clear">
                <Icon name="close" size={12} />
              </span>
            )}
          </div>
          <button
            type="button"
            className="nc-btn primary nc-lib-new-skill-btn"
            data-testid="lib-new-skill-btn"
            onClick={() => setModalSkill(null)}
          >
            <Icon name="plus" size={14} />
            <span>New skill</span>
          </button>
        </div>
      </div>

      {error && !filtered.length ? (
        <div className="nc-lib-empty skills">
          <div className="nc-lib-empty-text">Could not load skills.</div>
          <div role="button" className="nc-lib-linkbtn" onClick={() => void useSkills.getState().load(true)}>
            Retry
          </div>
        </div>
      ) : filtered.length ? (
        <div className="nc-ai-skill-list" role="list">
          {filtered.map((s) => (
            <SkillRow
              key={s.id}
              s={s}
              onEdit={(target) => setModalSkill(target)}
              onDelete={(target) => setConfirmDelete(target)}
            />
          ))}
        </div>
      ) : !loading ? (
        <div className="nc-lib-empty skills">
          <div className="nc-lib-empty-icon">
            <Icon name="libPaperSkill" size={32} />
          </div>
          <div className="nc-lib-empty-text">
            {search
              ? `No skills match "${search}".`
              : seg === 'enabled'
              ? 'No skills currently enabled. You can enable default skills or create your own.'
              : seg === 'discover'
              ? 'No disabled skills.'
              : 'No skills found. Create your first skill to begin.'}
          </div>
          <div role="button" className="nc-lib-linkbtn" onClick={() => setModalSkill(null)}>
            <Icon name="plus" size={16} />
            <span>New skill</span>
          </div>
        </div>
      ) : null}

      {/* Create / Edit Modal */}
      {modalSkill !== undefined && (
        <SkillModal
          open={modalSkill !== undefined}
          onClose={() => setModalSkill(undefined)}
          skill={modalSkill}
        />
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} width={420}>
          <div className="nc-skill-confirm-dialog">
            <div className="nc-skill-confirm-header">
              <Icon name="warning" size={20} style={{ color: 'var(--lp-red-icon-accent, #d93838)' }} />
              <h4>Delete skill</h4>
            </div>
            <p>
              Are you sure you want to delete <strong>{confirmDelete.name}</strong>?{' '}
              {confirmDelete.builtin
                ? 'This will disable the default skill.'
                : 'This will remove the skill from your workspace.'}
            </p>
            <div className="nc-skill-confirm-actions">
              <button type="button" className="nc-btn" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="nc-btn danger"
                data-testid="ai-skill-confirm-delete-btn"
                onClick={() => void handleDelete(confirmDelete)}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
