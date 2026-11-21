import React, { useEffect, useState } from 'react';
import { MapPin, PlusCircle, Edit2, Trash2, Globe } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import {
  SectionHeader, Field, TextInput, Select, PrimaryButton, GhostButton,
  IconButton, Banner, StatusPill, Modal, TableShell, SearchBox,
} from './ui';

interface Country {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  _count: { cities: number };
}

interface City {
  id: string;
  countryId: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  country: { id: string; code: string; nameAr: string; nameEn: string };
  _count: { branches: number };
}

const emptyCountry = { code: '', nameAr: '', nameEn: '' };
const emptyCity = { countryId: '', nameAr: '', nameEn: '' };

export function CitiesTab() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [filterCountry, setFilterCountry] = useState('');

  const [countryModal, setCountryModal] = useState(false);
  const [editingCountry, setEditingCountry] = useState<string | null>(null);
  const [countryForm, setCountryForm] = useState(emptyCountry);

  const [cityModal, setCityModal] = useState(false);
  const [editingCity, setEditingCity] = useState<string | null>(null);
  const [cityForm, setCityForm] = useState(emptyCity);
  const [saving, setSaving] = useState(false);

  const [citySearch, setCitySearch] = useState('');

  useEffect(() => {
    load();
  }, [filterCountry, citySearch]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterCountry) params.countryId = filterCountry;
      if (citySearch.trim()) params.search = citySearch.trim();

      const [countryRes, cityRes] = await Promise.all([
        api.get('/locations/countries'),
        api.get('/locations/cities', { params }),
      ]);
      setCountries(countryRes.data.countries || []);
      setCities(cityRes.data.cities || []);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function submitCountry(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      if (editingCountry) {
        await api.put(`/locations/countries/${editingCountry}`, countryForm);
        setMsg('✅ ' + t('md_countryUpdated'));
      } else {
        await api.post('/locations/countries', countryForm);
        setMsg('✅ ' + t('md_countryAdded'));
      }
      setCountryModal(false);
      setCountryForm(emptyCountry);
      setEditingCountry(null);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function deleteCountry(c: Country) {
    if (!confirm(`${t('md_confirmDelete')} "${isAr ? c.nameAr : c.nameEn}"؟`)) return;
    try {
      await api.delete(`/locations/countries/${c.id}`);
      setMsg('✅ ' + t('md_countryDeleted'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_deleteFailed')));
    }
  }

  function openAddCity() {
    setEditingCity(null);
    setCityForm({ ...emptyCity, countryId: filterCountry || countries[0]?.id || '' });
    setMsg('');
    setCityModal(true);
  }

  function openEditCity(c: City) {
    setEditingCity(c.id);
    setCityForm({ countryId: c.countryId, nameAr: c.nameAr, nameEn: c.nameEn });
    setMsg('');
    setCityModal(true);
  }

  async function submitCity(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      if (editingCity) {
        await api.put(`/locations/cities/${editingCity}`, cityForm);
        setMsg('✅ ' + t('md_cityUpdated'));
      } else {
        await api.post('/locations/cities', cityForm);
        setMsg('✅ ' + t('md_cityAdded'));
      }
      setCityModal(false);
      setCityForm(emptyCity);
      setEditingCity(null);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function deleteCity(c: City) {
    if (!confirm(`${t('md_confirmDelete')} "${isAr ? c.nameAr : c.nameEn}"؟`)) return;
    try {
      await api.delete(`/locations/cities/${c.id}`);
      setMsg('✅ ' + t('md_cityDeleted'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_deleteFailed')));
    }
  }

  return (
    <div className="space-y-5">
      <Banner message={msg} />

      <div className="glass-panel space-y-4 rounded-xl p-5">
        <SectionHeader
          icon={Globe}
          title={t('md_countries')}
          subtitle={t('md_countriesHint')}
          action={
            <PrimaryButton
              onClick={() => {
                setEditingCountry(null);
                setCountryForm(emptyCountry);
                setCountryModal(true);
              }}
            >
              <PlusCircle size={16} /> {t('md_addCountry')}
            </PrimaryButton>
          }
        />

        <div className="flex flex-wrap gap-2">
          {countries.map(c => (
            <div
              key={c.id}
              className={`group flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
                filterCountry === c.id
                  ? 'border-primary/50 bg-primary/10 text-white'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-300'
              }`}
            >
              <button
                onClick={() => setFilterCountry(filterCountry === c.id ? '' : c.id)}
                className="cursor-pointer font-semibold"
              >
                <span className="me-1.5 font-mono text-[11px] text-primary">{c.code}</span>
                {isAr ? c.nameAr : c.nameEn}
                <span className="ms-1.5 text-[11px] text-zinc-500">({c._count.cities})</span>
              </button>
              <span className="flex items-center opacity-0 transition group-hover:opacity-100">
                <IconButton
                  onClick={() => {
                    setEditingCountry(c.id);
                    setCountryForm({ code: c.code, nameAr: c.nameAr, nameEn: c.nameEn });
                    setCountryModal(true);
                  }}
                  title={t('edit')}
                >
                  <Edit2 size={13} />
                </IconButton>
                <IconButton tone="danger" onClick={() => deleteCountry(c)} title={t('delete')}>
                  <Trash2 size={13} />
                </IconButton>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel space-y-4 rounded-xl p-5">
        <SectionHeader
          icon={MapPin}
          title={t('md_cities')}
          subtitle={t('md_citiesHint')}
          action={
            <PrimaryButton onClick={openAddCity} disabled={countries.length === 0}>
              <PlusCircle size={16} /> {t('md_addCity')}
            </PrimaryButton>
          }
        />

        <SearchBox
          value={citySearch}
          onChange={setCitySearch}
          placeholder={t('md_searchCity')}
        />

        <TableShell
          headers={[t('md_nameAr'), t('md_nameEn'), t('md_country'), t('md_branchesShort'), t('md_status'), t('actions')]}
          loading={loading}
          loadingText={t('loading')}
          isEmpty={cities.length === 0}
          empty={t('md_noCities')}
        >
          {cities.map(c => (
            <tr key={c.id} className="border-b border-zinc-900 transition hover:bg-zinc-900/40">
              <td className="px-3 py-2.5 font-semibold text-white">{c.nameAr}</td>
              <td className="px-3 py-2.5 text-zinc-400">{c.nameEn}</td>
              <td className="px-3 py-2.5 text-zinc-400">{isAr ? c.country?.nameAr : c.country?.nameEn}</td>
              <td className="px-3 py-2.5 text-xs text-zinc-500">{c._count.branches}</td>
              <td className="px-3 py-2.5">
                <StatusPill active={c.isActive} activeText={t('md_active')} inactiveText={t('md_inactive')} />
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1">
                  <IconButton onClick={() => openEditCity(c)} title={t('edit')}>
                    <Edit2 size={15} />
                  </IconButton>
                  <IconButton tone="danger" onClick={() => deleteCity(c)} title={t('delete')}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>

      {countryModal && (
        <Modal title={editingCountry ? t('md_editCountry') : t('md_addCountry')} onClose={() => setCountryModal(false)}>
          <form onSubmit={submitCountry} className="space-y-3">
            <Field label={t('md_countryCode')} hint="SA, AE, EG…">
              <TextInput
                required
                maxLength={3}
                value={countryForm.code}
                onChange={e => setCountryForm({ ...countryForm, code: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label={t('md_nameAr')}>
              <TextInput required value={countryForm.nameAr} onChange={e => setCountryForm({ ...countryForm, nameAr: e.target.value })} />
            </Field>
            <Field label={t('md_nameEn')}>
              <TextInput required value={countryForm.nameEn} onChange={e => setCountryForm({ ...countryForm, nameEn: e.target.value })} />
            </Field>
            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setCountryModal(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}

      {cityModal && (
        <Modal title={editingCity ? t('md_editCity') : t('md_addCity')} onClose={() => setCityModal(false)}>
          <form onSubmit={submitCity} className="space-y-3">
            <Field label={t('md_country')}>
              <Select required value={cityForm.countryId} onChange={e => setCityForm({ ...cityForm, countryId: e.target.value })}>
                <option value="">{t('md_selectCountry')}</option>
                {countries.map(c => (
                  <option key={c.id} value={c.id}>
                    {isAr ? c.nameAr : c.nameEn}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('md_nameAr')}>
              <TextInput required value={cityForm.nameAr} onChange={e => setCityForm({ ...cityForm, nameAr: e.target.value })} />
            </Field>
            <Field label={t('md_nameEn')}>
              <TextInput required value={cityForm.nameEn} onChange={e => setCityForm({ ...cityForm, nameEn: e.target.value })} />
            </Field>
            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setCityModal(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
