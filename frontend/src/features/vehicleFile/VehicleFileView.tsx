import React, { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  X, Printer, Share2, Link2Off, Copy, PlusCircle, FileText, Wrench, Gauge, RefreshCw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/LanguageContext';
import {
  Field, TextInput, TextArea, Select, PrimaryButton, GhostButton, Banner, Modal,
} from '../admin/ui';
import { VehicleFileContent } from './VehicleFileContent';
import type { VehicleFile } from './VehicleFileContent';

const emptyDoc = {
  type: 'REGISTRATION',
  title: '',
  documentNumber: '',
  issuer: '',
  issueDate: '',
  expiryDate: '',
  notes: '',
};

const emptyPart = {
  jobCardId: '',
  partId: '',
  partName: '',
  partNumber: '',
  quantity: '1',
  unitPrice: '0',
  mileageAtReplacement: '',
  replacedAt: '',
  warrantyMonths: '',
  notes: '',
};

export function VehicleFileView({ vehicleId, onClose }: { vehicleId: string; onClose: () => void }) {
  const { lang, t } = useTranslation();
  const { user } = useAuthStore();
  const isAr = lang === 'ar';
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RECEPTION';

  const [file, setFile] = useState<VehicleFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [catalogParts, setCatalogParts] = useState<any[]>([]);

  const [docModal, setDocModal] = useState(false);
  const [docForm, setDocForm] = useState(emptyDoc);
  const [partModal, setPartModal] = useState(false);
  const [partForm, setPartForm] = useState(emptyPart);
  const [mileageModal, setMileageModal] = useState(false);
  const [mileageForm, setMileageForm] = useState({ mileage: '', note: '' });
  const [shareModal, setShareModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    loadParts();
  }, [vehicleId]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/vehicle-file/${vehicleId}`);
      setFile(res.data);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_loadFailed')));
    } finally {
      setLoading(false);
    }
  }

  async function loadParts() {
    try {
      const res = await api.get('/parts', { params: { limit: '100' } });
      setCatalogParts(res.data.parts || []);
    } catch {
      // The catalogue is optional here — a part can be typed in by hand.
    }
  }

  async function submitDocument(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api.post(`/vehicle-file/${vehicleId}/documents`, {
        type: docForm.type,
        title: docForm.title.trim() || null,
        documentNumber: docForm.documentNumber.trim() || null,
        issuer: docForm.issuer.trim() || null,
        issueDate: docForm.issueDate || null,
        expiryDate: docForm.expiryDate || null,
        notes: docForm.notes.trim() || null,
      });
      setMsg('✅ ' + t('vf_documentAdded'));
      setDocModal(false);
      setDocForm(emptyDoc);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function submitPart(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api.post(`/vehicle-file/${vehicleId}/parts`, {
        jobCardId: partForm.jobCardId || null,
        partId: partForm.partId || null,
        partName: partForm.partName.trim(),
        partNumber: partForm.partNumber.trim() || null,
        quantity: Number(partForm.quantity),
        unitPrice: Number(partForm.unitPrice),
        mileageAtReplacement: partForm.mileageAtReplacement ? Number(partForm.mileageAtReplacement) : null,
        replacedAt: partForm.replacedAt || undefined,
        warrantyMonths: partForm.warrantyMonths ? Number(partForm.warrantyMonths) : null,
        notes: partForm.notes.trim() || null,
      });
      setMsg('✅ ' + t('vf_partAdded'));
      setPartModal(false);
      setPartForm(emptyPart);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function submitMileage(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api.post(`/vehicle-file/${vehicleId}/mileage`, {
        mileage: Number(mileageForm.mileage),
        note: mileageForm.note.trim() || null,
      });
      setMsg('✅ ' + t('vf_mileageAdded'));
      setMileageModal(false);
      setMileageForm({ mileage: '', note: '' });
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function createShare() {
    setSaving(true);
    try {
      // The API client always sets a JSON content-type, so an empty body
      // would be rejected by Fastify — send an explicit empty object.
      await api.post(`/vehicle-file/${vehicleId}/share`, {});
      await load();
      setShareModal(true);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function revokeShare() {
    if (!confirm(t('vf_confirmRevoke'))) return;
    try {
      await api.delete(`/vehicle-file/${vehicleId}/share`);
      setShareModal(false);
      setMsg('✅ ' + t('vf_shareRevoked'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  const shareUrl = file?.vehicle?.shareToken
    ? `${window.location.origin}/?file=${file.vehicle.shareToken}`
    : '';

  function copyShareUrl() {
    navigator.clipboard?.writeText(shareUrl);
    setMsg('✅ ' + t('vf_linkCopied'));
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm">
      <div className="mx-auto min-h-screen w-full max-w-5xl p-4">
        {/* Toolbar */}
        <div className="no-print sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur">
          <h1 className="text-base font-bold text-white">{t('vf_title')}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <>
                <GhostButton onClick={() => setMileageModal(true)} className="!px-3 !py-1.5 text-xs">
                  <Gauge size={14} /> {t('vf_addMileage')}
                </GhostButton>
                <GhostButton onClick={() => setPartModal(true)} className="!px-3 !py-1.5 text-xs">
                  <Wrench size={14} /> {t('vf_addPart')}
                </GhostButton>
                <GhostButton onClick={() => setDocModal(true)} className="!px-3 !py-1.5 text-xs">
                  <FileText size={14} /> {t('vf_addDocument')}
                </GhostButton>
                <GhostButton
                  onClick={() => (file?.vehicle?.shareToken ? setShareModal(true) : createShare())}
                  disabled={saving}
                  className="!px-3 !py-1.5 text-xs"
                >
                  <Share2 size={14} /> {t('vf_share')}
                </GhostButton>
              </>
            )}
            <GhostButton onClick={() => window.print()} className="!px-3 !py-1.5 text-xs">
              <Printer size={14} /> {t('vf_print')}
            </GhostButton>
            <GhostButton onClick={load} disabled={loading} className="!px-3 !py-1.5 text-xs">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </GhostButton>
            <button onClick={onClose} className="cursor-pointer p-1.5 text-zinc-400 transition hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="no-print mb-3">
          <Banner message={msg} />
        </div>

        {loading && !file ? (
          <p className="py-20 text-center text-sm text-zinc-500">{t('loading')}</p>
        ) : file ? (
          <div className="pb-10">
            <VehicleFileContent file={file} />
          </div>
        ) : (
          <p className="py-20 text-center text-sm text-zinc-500">{t('md_loadFailed')}</p>
        )}
      </div>

      {/* Add document */}
      {docModal && (
        <Modal title={t('vf_addDocument')} onClose={() => setDocModal(false)}>
          <form onSubmit={submitDocument} className="space-y-3">
            <Field label={t('vf_documentType')}>
              <Select value={docForm.type} onChange={e => setDocForm({ ...docForm, type: e.target.value })}>
                <option value="REGISTRATION">{t('vf2_registration')}</option>
                <option value="INSURANCE">{t('vf2_insurance')}</option>
                <option value="PERIODIC_INSPECTION">{t('vf2_periodicInspection')}</option>
                <option value="OTHER">{t('vf2_other')}</option>
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('vf_documentTitle')}>
                <TextInput value={docForm.title} onChange={e => setDocForm({ ...docForm, title: e.target.value })} />
              </Field>
              <Field label={t('vf_documentNumber')}>
                <TextInput
                  value={docForm.documentNumber}
                  onChange={e => setDocForm({ ...docForm, documentNumber: e.target.value })}
                />
              </Field>
              <Field label={t('vf_issueDate')}>
                <TextInput
                  type="date"
                  value={docForm.issueDate}
                  onChange={e => setDocForm({ ...docForm, issueDate: e.target.value })}
                />
              </Field>
              <Field label={t('vf_expiryDate')} hint={t('vf_expiryHint')}>
                <TextInput
                  type="date"
                  value={docForm.expiryDate}
                  onChange={e => setDocForm({ ...docForm, expiryDate: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t('vf_issuer')}>
              <TextInput value={docForm.issuer} onChange={e => setDocForm({ ...docForm, issuer: e.target.value })} />
            </Field>
            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setDocModal(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Add replaced part */}
      {partModal && (
        <Modal title={t('vf_addPart')} onClose={() => setPartModal(false)}>
          <form onSubmit={submitPart} className="space-y-3">
            <Field label={t('vf_fromCatalog')} hint={t('vf_fromCatalogHint')}>
              <Select
                value={partForm.partId}
                onChange={e => {
                  const p = catalogParts.find(x => x.id === e.target.value);
                  setPartForm({
                    ...partForm,
                    partId: e.target.value,
                    partName: p ? p.nameAr : partForm.partName,
                    partNumber: p ? p.partNumber : partForm.partNumber,
                    unitPrice: p ? String(p.sellPrice) : partForm.unitPrice,
                  });
                }}
              >
                <option value="">{t('vf_manualEntry')}</option>
                {catalogParts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr} — {p.partNumber}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('vf_part')}>
                <TextInput
                  required
                  value={partForm.partName}
                  onChange={e => setPartForm({ ...partForm, partName: e.target.value })}
                />
              </Field>
              <Field label={t('md_partNumber')}>
                <TextInput
                  value={partForm.partNumber}
                  onChange={e => setPartForm({ ...partForm, partNumber: e.target.value })}
                />
              </Field>
              <Field label={t('md_quantity')}>
                <TextInput
                  type="number"
                  min={1}
                  value={partForm.quantity}
                  onChange={e => setPartForm({ ...partForm, quantity: e.target.value })}
                />
              </Field>
              <Field label={t('vf_unitPrice')}>
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={partForm.unitPrice}
                  onChange={e => setPartForm({ ...partForm, unitPrice: e.target.value })}
                />
              </Field>
              <Field label={t('vf_replacedAt')}>
                <TextInput
                  type="date"
                  value={partForm.replacedAt}
                  onChange={e => setPartForm({ ...partForm, replacedAt: e.target.value })}
                />
              </Field>
              <Field label={t('vf_warrantyMonths')} hint={t('vf_warrantyHint')}>
                <TextInput
                  type="number"
                  min={0}
                  max={240}
                  value={partForm.warrantyMonths}
                  onChange={e => setPartForm({ ...partForm, warrantyMonths: e.target.value })}
                />
              </Field>
            </div>

            <Field label={t('vf_linkJobCard')}>
              <Select value={partForm.jobCardId} onChange={e => setPartForm({ ...partForm, jobCardId: e.target.value })}>
                <option value="">{t('vf_noJobCard')}</option>
                {file?.jobCards?.map(jc => (
                  <option key={jc.id} value={jc.id}>
                    {jc.jobNumber} — {new Date(jc.entryDate).toISOString().slice(0, 10)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('md_notes')}>
              <TextArea rows={2} value={partForm.notes} onChange={e => setPartForm({ ...partForm, notes: e.target.value })} />
            </Field>

            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setPartModal(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Add mileage reading */}
      {mileageModal && (
        <Modal title={t('vf_addMileage')} onClose={() => setMileageModal(false)}>
          <form onSubmit={submitMileage} className="space-y-3">
            <Field
              label={t('vf_currentMileage')}
              hint={`${t('vf_lastReading')}: ${file?.summary?.currentMileage?.toLocaleString() ?? '—'}`}
            >
              <TextInput
                type="number"
                min={0}
                required
                value={mileageForm.mileage}
                onChange={e => setMileageForm({ ...mileageForm, mileage: e.target.value })}
              />
            </Field>
            <Field label={t('md_notes')}>
              <TextInput value={mileageForm.note} onChange={e => setMileageForm({ ...mileageForm, note: e.target.value })} />
            </Field>
            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setMileageModal(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Share link */}
      {shareModal && shareUrl && (
        <Modal title={t('vf_shareTitle')} onClose={() => setShareModal(false)}>
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-zinc-400">{t('vf_shareHint')}</p>

            <div className="flex justify-center rounded-xl bg-white p-4">
              <QRCodeCanvas value={shareUrl} size={180} level="M" />
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
              <p className="break-all font-mono text-[11px] text-zinc-400" dir="ltr">
                {shareUrl}
              </p>
            </div>

            <div className="flex gap-2">
              <PrimaryButton onClick={copyShareUrl} className="flex-1">
                <Copy size={15} /> {t('vf_copyLink')}
              </PrimaryButton>
              <GhostButton onClick={createShare} disabled={saving}>
                <RefreshCw size={15} /> {t('vf_rotateLink')}
              </GhostButton>
            </div>

            <button
              onClick={revokeShare}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/20"
            >
              <Link2Off size={14} /> {t('vf_revokeLink')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
