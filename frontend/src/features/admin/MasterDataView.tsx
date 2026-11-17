import React, { useState } from 'react';
import { Building2, MapPin, Car, Wrench, DatabaseBackup, BadgeCheck } from 'lucide-react';
import { useTranslation } from '../../store/LanguageContext';
import { BranchesTab } from './BranchesTab';
import { CitiesTab } from './CitiesTab';
import { VehicleModelsTab } from './VehicleModelsTab';
import { PartsTab } from './PartsTab';
import { PlansTab } from './PlansTab';
import { BackupTab } from './BackupTab';

type TabId = 'branches' | 'cities' | 'models' | 'parts' | 'plans' | 'backup';

export function MasterDataView() {
  const { lang, t } = useTranslation();
  const [tab, setTab] = useState<TabId>('branches');

  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
    { id: 'branches', label: t('md_branches'), icon: Building2 },
    { id: 'cities', label: t('md_citiesAndCountries'), icon: MapPin },
    { id: 'models', label: t('md_models'), icon: Car },
    { id: 'parts', label: t('md_parts'), icon: Wrench },
    { id: 'plans', label: t('sub_plans'), icon: BadgeCheck },
    { id: 'backup', label: t('md_backup'), icon: DatabaseBackup },
  ];

  return (
    <div className={`space-y-6 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{t('masterData')}</h1>
        <p className="text-sm text-zinc-400">{t('md_subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-900 pb-3">
        {tabs.map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                active
                  ? 'bg-primary text-white'
                  : 'border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'branches' && <BranchesTab />}
      {tab === 'cities' && <CitiesTab />}
      {tab === 'models' && <VehicleModelsTab />}
      {tab === 'parts' && <PartsTab />}
      {tab === 'plans' && <PlansTab />}
      {tab === 'backup' && <BackupTab />}
    </div>
  );
}
