import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { useTranslation } from '../store/LanguageContext';

/**
 * قائمة منسدلة بحقل بحث.
 *
 * القوائم الطويلة في النظام — العملاء والسيارات والماركات والمدن والفروع
 * والفنيين — كانت قوائم المتصفح العادية: لا سبيل فيها إلا التمرير بالعين
 * بحثًا عن اسم بين عشرات. ومع نمو بيانات الورشة يزداد الأمر سوءًا، لأن
 * قائمة العملاء وحدها تبلغ المئات بعد أشهر.
 *
 * البحث هنا يتجاهل التشكيل ويوحّد صور الألف والياء والتاء المربوطة، فمن
 * كتب «احمد» وجد «أحمد»، ومن كتب «علي» وجد «علىّ».
 */

export interface SelectOption {
  value: string;
  label: string;
  /** سطر صغير تحت الاسم: اللوحة، رقم الجوال، الكود… */
  hint?: string;
  /** خيار يتصدّر القائمة ولا يُفلتر، مثل «إضافة عميل جديد». */
  pinned?: boolean;
}

/** يوحّد الحروف التي تُكتب بصور متعددة حتى يجد البحث ما يقصده الكاتب. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '') // تشكيل وتطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .trim();
}

/** عدد الخيارات الذي يصير البحث عنده مفيدًا؛ دونه يكون الحقل حشوًا. */
const SEARCH_FROM = 8;

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className = '',
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const { t, lang } = useTranslation();
  const isRtl = lang === 'ar';

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value) || null;
  const showSearch = options.length >= SEARCH_FROM;

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter(
      o => o.pinned || normalize(o.label).includes(q) || normalize(o.hint || '').includes(q),
    );
  }, [options, query]);

  // الإغلاق بالنقر خارج القائمة أو بـ Escape
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenState(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenState(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && showSearch) searchRef.current?.focus();
  }, [open, showSearch]);

  /** الفتح والإغلاق في مكان واحد، فيُصفّر البحث مع الإغلاق دائمًا. */
  function setOpenState(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery('');
      setActive(0);
    }
  }

  // إبقاء الخيار النشط داخل مجال الرؤية أثناء التنقل بالأسهم
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function choose(option: SelectOption) {
    onChange(option.value);
    setOpenState(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpenState(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    }
  }

  const control =
    'w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/60';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpenState(!open)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${control} flex cursor-pointer items-center justify-between gap-2 text-start disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className={`truncate ${selected ? 'text-white' : 'text-zinc-500'}`}>
          {selected ? selected.label : placeholder || t('ss_choose')}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-zinc-500 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl">
          {showSearch && (
            <div className="relative border-b border-zinc-800 p-2">
              <Search
                size={14}
                className="pointer-events-none absolute top-1/2 start-4 -translate-y-1/2 text-zinc-600"
              />
              <input
                ref={searchRef}
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={t('ss_search')}
                className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 ps-8 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-primary/60"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={t('ss_clear')}
                  className="absolute top-1/2 end-4 -translate-y-1/2 cursor-pointer text-zinc-600 transition hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          <div ref={listRef} className="max-h-64 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-zinc-600">{t('ss_noMatch')}</p>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value || `empty-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-active={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(option)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-start text-xs transition ${
                      index === active ? 'bg-zinc-900' : ''
                    } ${option.pinned ? 'font-bold text-emerald-400' : 'text-zinc-200'}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.hint && (
                        <span className="block truncate text-[10px] text-zinc-500" dir={isRtl ? 'rtl' : 'ltr'}>
                          {option.hint}
                        </span>
                      )}
                    </span>
                    {isSelected && <Check size={13} className="shrink-0 text-primary-text" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
