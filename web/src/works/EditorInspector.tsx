import React from 'react';
import type { EditorSelection, Field, Section } from '../../../templates/src/form';
import type { TemplateDef } from '../../../templates/src/registry';
import { Disclosure, IconButton } from '../ui/controls';
import { Icon } from '../ui/icons';
import { Inspector } from '../ui/layout';
import { FieldList } from './fields';

/**
 * 模板编辑的右边面板：最上面是选中的东西（气泡 2、推近…）的参数，
 * 下面其余几组收起来。在时间轴上点哪块，这里就换成哪块。
 */

type Values = Record<string, unknown>;
type ListField = Extract<Field, { kind: 'list' }>;

export function findList(template: TemplateDef, key: string): { section: Section; field: ListField } | null {
  for (const section of template.form) {
    for (const f of section.fields) if (f.kind === 'list' && f.key === key) return { section, field: f };
  }
  return null;
}

/** 列表里一项的简短说明：第一个文字字段的内容，比如气泡的那句话 */
function itemSummary(field: ListField, item: Values): string {
  const text = field.fields.find((f) => f.kind === 'text');
  const v = text ? String(item[text.key] ?? '') : '';
  return v || '（还没写字）';
}

export function EditorInspector({ template, params, selection, onSelect, onChange }: {
  template: TemplateDef;
  params: Values;
  selection: EditorSelection | null;
  onSelect: (s: EditorSelection | null) => void;
  onChange: (key: string, value: unknown) => void;
}) {
  const hasTimeline = !!template.timeline;
  let title: React.ReactNode = '整体设置';
  let subtitle: React.ReactNode = '点时间轴上的色块，或者下面的某一组';
  let aside: React.ReactNode = null;
  let top: React.ReactNode = null;
  let current: string | null = null;

  const listItems = (key: string) => (Array.isArray(params[key]) ? (params[key] as Values[]) : []);
  const setList = (key: string, items: Values[]) => onChange(key, items);

  if (selection && 'list' in selection) {
    const found = findList(template, selection.list);
    const items = listItems(selection.list);
    const item = items[selection.index];
    if (found && item) {
      const { field } = found;
      const i = selection.index;
      title = `${field.itemLabel} ${i + 1}`;
      subtitle = hasTimeline ? '时间也可以在下面时间轴上直接拖' : undefined;
      const move = (d: -1 | 1) => {
        const j = i + d;
        if (j < 0 || j >= items.length) return;
        const next = items.slice();
        [next[i], next[j]] = [next[j] as Values, next[i] as Values];
        setList(field.key, next);
        onSelect({ list: field.key, index: j });
      };
      aside = (
        <div className="head-actions">
          <IconButton label={`上移这个${field.itemLabel}`} disabled={i === 0} onClick={() => move(-1)}><Icon.arrowUp size={15} /></IconButton>
          <IconButton label={`下移这个${field.itemLabel}`} disabled={i === items.length - 1} onClick={() => move(1)}><Icon.arrowDown size={15} /></IconButton>
          <IconButton
            label={`删掉这个${field.itemLabel}`}
            onClick={() => {
              setList(field.key, items.filter((_, j) => j !== i));
              onSelect(items.length > 1 ? { list: field.key, index: Math.max(0, i - 1) } : null);
            }}
          >
            <Icon.trash size={15} />
          </IconButton>
        </div>
      );
      top = (
        <FieldList
          fields={field.fields}
          values={item}
          onChange={(k, v) => setList(field.key, items.map((it, j) => (j === i ? { ...it, [k]: v } : it)))}
        />
      );
    }
  } else if (selection && 'section' in selection) {
    const section = template.form.find((s) => s.title === selection.section);
    if (section) {
      current = section.title;
      title = section.title;
      subtitle = hasTimeline && section.fields.some((f) => f.kind === 'number') ? '时间也可以在下面时间轴上直接拖' : undefined;
      top = <FieldList fields={section.fields} values={params} onChange={onChange} renderList={renderListRows} />;
    }
  }

  // 列表（气泡）画成一行一行，点哪行就选中哪个。用普通函数而不是组件，重画时焦点不会丢
  function renderListRows(field: ListField) {
    const items = listItems(field.key);
    return (
      <div className="item-rows">
        {items.map((it, i) => {
          const on = !!selection && 'list' in selection && selection.list === field.key && selection.index === i;
          return (
            <button key={i} type="button" className="item-row" aria-pressed={on} onClick={() => onSelect({ list: field.key, index: i })}>
              <span className="item-row-label">{field.itemLabel} {i + 1}</span>
              <span className="item-row-text">{itemSummary(field, it)}</span>
              <Icon.chevronRight size={12} />
            </button>
          );
        })}
        <button
          type="button"
          className="item-row add"
          onClick={() => {
            const next = [...items, field.newItem(items)];
            setList(field.key, next);
            onSelect({ list: field.key, index: next.length - 1 });
          }}
        >
          <Icon.plus size={13} />加一个{field.itemLabel}
        </button>
      </div>
    );
  }

  const others = template.form.filter((s) => s.title !== current);
  return (
    <Inspector label="参数" title={title} subtitle={subtitle} aside={aside}>
      {top}
      <div className="disclosure-stack">
        {top && <div className="group-caption">其他设置</div>}
        {others.map((s) => (
          <Disclosure
            key={s.title}
            title={s.title}
            summary={s.fields.map((f) => f.label).slice(0, 3).join(' · ')}
            storageKey={`editor:${template.id}:${s.title}`}
            defaultOpen={!top}
          >
            <FieldList fields={s.fields} values={params} onChange={onChange} renderList={renderListRows} />
          </Disclosure>
        ))}
      </div>
    </Inspector>
  );
}
