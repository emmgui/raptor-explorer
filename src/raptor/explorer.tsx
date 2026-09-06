import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Focus,
  Maximize2,
  Move3D,
  Pause,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import {
  generationCopy,
  initialSettings,
  zeroTransform,
  type EngineInfo,
  type ExplorerSettings,
  type Generation,
  type PartTransform,
} from './types';
import type { RaptorController } from './viewer';

export default function RaptorExplorer() {
  const inspector = useRef<HTMLElement>(null);
  const overviewPending = useRef(false);
  const motionElapsed = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null),
    comparisonLabels = useRef<(HTMLSpanElement | null)[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null),
    viewer = useRef<RaptorController | null>(null),
    settingsRef = useRef(initialSettings);
  const [settings, setSettings] = useState<ExplorerSettings>(initialSettings),
    [info, setInfo] = useState<EngineInfo | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const [system, setSystem] = useState('all'),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(60),
    [labels, setLabels] = useState(true),
    [reference, setReference] = useState(false),
    [mobilePanel, setMobilePanel] = useState(false),
    [motion, setMotion] = useState(false),
    [reduced, setReduced] = useState(false);
  const [hover, setHover] = useState<{
      name: string;
      x: number;
      y: number;
    } | null>(null),
    [toast, setToast] = useState('');
  const patch = useCallback(
    (v: Partial<ExplorerSettings>) => setSettings((s) => ({ ...s, ...v })),
    [],
  );
  useEffect(() => {
    settingsRef.current = settings;
    viewer.current?.update(settings);
    if (overviewPending.current) {
      viewer.current?.view('hero');
      overviewPending.current = false;
    }
  }, [settings]);
  useEffect(() => {
    viewer.current?.update(settingsRef.current);
  }, [labels, ready]);
  useEffect(() => {
    let cancelled = false;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const f = requestAnimationFrame(() => setReduced(mq.matches));
    import('./viewer')
      .then(async ({ createRaptorViewer }) => {
        if (cancelled || !canvas.current) return;
        const v = await createRaptorViewer(canvas.current, {
          onInfo: (i) => {
            if (!cancelled) setInfo(i);
          },
          onSelect: (id, inspect, generation) =>
            setSettings((s) => ({
              ...s,
              generation: generation ?? s.generation,
              selected: id || null,
              isolated: id ? inspect || s.isolated : false,
            })),
          onHover: setHover,
          onLabels: (values) =>
            values.forEach((v) => {
              const label = comparisonLabels.current[v.generation - 1];
              if (label) {
                label.style.left = `${v.x}px`;
                label.style.top = `${v.y}px`;
                label.style.visibility = v.visible ? 'visible' : 'hidden';
              }
            }),
          onError: (message) => setError(message),
        });
        if (cancelled) {
          v.dispose();
          return;
        }
        viewer.current = v;
        v.update(settingsRef.current);
        setReady(true);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled)
          setError(
            'The 3D workspace could not start. Check that graphics acceleration is enabled, then reload.',
          );
      });
    const change = () => {
      setReduced(mq.matches);
      if (mq.matches) {
        patch({ spin: false });
        setMotion(false);
      }
    };
    mq.addEventListener('change', change);
    return () => {
      cancelled = true;
      cancelAnimationFrame(f);
      mq.removeEventListener('change', change);
      viewer.current?.dispose();
      viewer.current = null;
    };
  }, [patch]);
  useEffect(() => {
    if (!motion) return;
    let frame = 0,
      last = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      if (!document.hidden) motionElapsed.current += now - previous;
      previous = now;
      if (now - last > 35) {
        last = now;
        const p = motionElapsed.current / 12000;
        if (p >= 1) {
          patch({ separation: 0, detail: 0 });
          motionElapsed.current = 0;
          setMotion(false);
          return;
        }
        const a = (1 - Math.cos(p * Math.PI * 2)) / 2;
        patch({ separation: a, detail: a * 0.65 });
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [motion, patch]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setReference(false);
        setMobilePanel(false);
        patch({ isolated: false, isolatedSystem: null, selected: null });
      }
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [patch]);
  useEffect(() => {
    if (reference) dialog.current?.showModal();
    else dialog.current?.close();
  }, [reference]);
  const partIndex = useMemo(
    () => new Map(info?.parts.map((p) => [p.id, p])),
    [info],
  );
  const selected = settings.selected
    ? partIndex.get(settings.selected)
    : undefined;
  const selectedSystem = info?.systems.find(
    (s) => s.id === (selected?.system ?? system),
  );
  const candidates = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (
      info?.parts.filter(
        (p) =>
          (system === 'all' || p.system === system) &&
          (!search ||
            `${p.name} ${p.group} ${p.material}`
              .toLowerCase()
              .includes(search)),
      ) ?? []
    );
  }, [info, system, query]);
  const changeGeneration = (generation: Generation) => {
    setSystem('all');
    setQuery('');
    setPage(60);
    patch({
      generation,
      selected: null,
      isolated: false,
      isolatedSystem: null,
    });
  };
  const pick = (id: string, inspect = false) => {
    const part = partIndex.get(id);
    patch({
      selected: id,
      isolated: inspect,
      isolatedSystem: null,
      mode: part?.internal
        ? 'internals'
        : settings.mode === 'internals'
          ? 'surface'
          : settings.mode,
    });
    if (inspect) {
      viewer.current?.focus(id);
      setMobilePanel(false);
      inspector.current?.scrollTo({ top: 0 });
    }
  };
  const reset = () => {
    overviewPending.current = true;
    setSettings({
      ...initialSettings,
      generation: settings.generation,
      compare: settings.compare,
    });
    setMotion(false);
    setSystem('all');
    setQuery('');
    motionElapsed.current = 0;
    setToast('Assembly and view restored');
  };
  const transform = selected
    ? (settings.transforms[selected.id] ?? zeroTransform)
    : zeroTransform;
  const modify = (key: keyof PartTransform, value: number) => {
    if (selected)
      patch({
        transforms: {
          ...settings.transforms,
          [selected.id]: { ...transform, [key]: value },
        },
      });
  };
  return (
    <main className="raptor-app">
      <header className="app-header" inert={reference}>
        <a className="identity" href="/" aria-label="Raptor engine explorer">
          <span className="identity-wordmark">Raptor</span>
          <span className="identity-subtitle">Engine explorer</span>
        </a>
        <div className="generation-switch" aria-label="Engine generation">
          {([1, 2, 3] as const).map((g) => (
            <button
              key={g}
              className={settings.generation === g ? 'chosen' : ''}
              aria-pressed={settings.generation === g}
              onClick={() => changeGeneration(g)}
            >
              Raptor {g}
            </button>
          ))}
        </div>
        <div className="header-actions">
          <button
            className={`compare-button ${settings.compare ? 'chosen' : ''}`}
            aria-pressed={settings.compare}
            onClick={() => {
              patch({
                compare: !settings.compare,
                selected: null,
                isolated: false,
                isolatedSystem: null,
              });
            }}
          >
            <Box size={16} />
            <span>Compare engines</span>
          </button>
          <button
            className="reference-button"
            onClick={() => setReference(true)}
          >
            About this model
            <ArrowUpRight size={14} />
          </button>
        </div>
      </header>
      <div className="workbench" inert={reference}>
        <section className="viewport" aria-label="Interactive Raptor engine">
          <div className="view-toolbar">
            <div className="mode-switch" aria-label="Surface visualization">
              {(['surface', 'cutaway', 'internals'] as const).map((mode) => (
                <button
                  key={mode}
                  className={settings.mode === mode ? 'chosen' : ''}
                  onClick={() => {
                    const restoreOverview =
                      mode === 'surface' && selected?.internal;
                    if (restoreOverview) overviewPending.current = true;
                    patch({
                      mode,
                      ...(restoreOverview
                        ? { selected: null, isolated: false }
                        : {}),
                    });
                  }}
                  aria-pressed={settings.mode === mode}
                >
                  {mode === 'internals'
                    ? 'Internals'
                    : mode === 'cutaway'
                      ? 'Cutaway'
                      : 'Surface'}
                </button>
              ))}
            </div>
            <div className="view-actions">
              <select
                aria-label="Camera projection"
                value={settings.projection}
                onChange={(e) =>
                  patch({
                    projection: e.target
                      .value as ExplorerSettings['projection'],
                  })
                }
              >
                <option value="perspective">Perspective</option>
                <option value="orthographic">Orthographic</option>
              </select>
              <button
                className="icon-button"
                aria-label="Fit the full assembly"
                onClick={() => viewer.current?.view('fit')}
              >
                <Maximize2 size={17} />
              </button>
            </div>
          </div>
          <canvas
            ref={canvas}
            aria-label="Raptor engine model. Drag to orbit, scroll to zoom, shift-drag to pan. Select a component from the component atlas for keyboard access."
          />
          {!ready && !error && (
            <div className="model-loading">
              <span className="loading-orbit" />
              <p>Preparing the engine</p>
              <span>Loading geometry and materials</span>
            </div>
          )}
          {error && (
            <div className="model-error" role="alert">
              <p>{error}</p>
              <button onClick={() => location.reload()}>
                Reload the workspace
              </button>
            </div>
          )}
          {labels && !settings.compare && !selected && ready && (
            <div className="model-caption">
              <span>{generationCopy[settings.generation].year}</span>
              <h1>Raptor {settings.generation}</h1>
              <p>{generationCopy[settings.generation].subtitle}</p>
            </div>
          )}
          {settings.compare && labels && (
            <div className="comparison-captions">
              {[1, 2, 3].map((g) => (
                <span
                  key={g}
                  ref={(node) => {
                    comparisonLabels.current[g - 1] = node;
                  }}
                >
                  Raptor {g}
                </span>
              ))}
            </div>
          )}
          {selected && (
            <div className="selection-caption">
              <span>{selectedSystem?.name}</span>
              <strong>{selected.name}</strong>
              <button
                aria-label="Clear component selection"
                onClick={() => patch({ selected: null, isolated: false })}
              >
                <X size={13} />
              </button>
            </div>
          )}
          {hover && (
            <div
              className="part-tooltip"
              style={{ left: hover.x, top: hover.y }}
            >
              {hover.name}
            </div>
          )}
          {settings.mode === 'cutaway' && (
            <div className="cut-controls">
              <span>Section plane</span>
              <label>
                Angle
                <input
                  aria-label="Section angle"
                  type="range"
                  min="0"
                  max="360"
                  value={settings.cutAngle}
                  onChange={(e) => patch({ cutAngle: +e.target.value })}
                />
              </label>
              <label>
                Depth
                <input
                  aria-label="Section depth"
                  type="range"
                  min="-2"
                  max="2"
                  step=".01"
                  value={settings.cutOffset}
                  onChange={(e) => patch({ cutOffset: +e.target.value })}
                />
              </label>
            </div>
          )}
          {settings.mode === 'internals' && (
            <p className="internal-caption">Illustrative internal geometry</p>
          )}
          <div className="viewport-bottom">
            <div className="orbit-instructions">
              <Move3D size={15} />
              <span>
                Drag to orbit
                <span className="instruction-extra">
                  {' '}
                  · Scroll to zoom · Double-click to inspect
                </span>
              </span>
            </div>
            <div className="viewport-toggles">
              <button
                className={labels ? 'is-active' : ''}
                aria-pressed={labels}
                onClick={() => setLabels(!labels)}
              >
                Labels
              </button>
              <button
                aria-label="Toggle studio lighting"
                onClick={() =>
                  patch({
                    lighting:
                      settings.lighting === 'studio' ? 'contrast' : 'studio',
                  })
                }
              >
                <Sun size={14} />
                <span>Light</span>
              </button>
              <button onClick={reset}>
                <RotateCcw size={13} />
                Reset
              </button>
            </div>
          </div>
          <div className="axis-views" aria-label="View direction">
            {(['hero', 'front', 'right', 'back', 'top'] as const).map((v) => (
              <button
                key={v}
                aria-label={`${v === 'hero' ? 'Three-quarter' : v} view`}
                onClick={() => viewer.current?.view(v)}
              >
                {v === 'hero'
                  ? '3/4'
                  : v === 'front'
                    ? 'F'
                    : v === 'right'
                      ? 'R'
                      : v === 'back'
                        ? 'B'
                        : 'T'}
              </button>
            ))}
          </div>
        </section>
        <button
          className="inspector-mobile-button"
          onClick={() => setMobilePanel(!mobilePanel)}
          aria-expanded={mobilePanel}
        >
          <SlidersHorizontal size={16} />
          {selected ? 'Inspect selected part' : 'Explore components'}
          <ChevronDown size={16} />
        </button>
        <aside
          ref={inspector}
          className={`inspector ${mobilePanel ? 'mobile-open' : ''}`}
          aria-label="Component inspector"
        >
          <div className="inspector-header">
            <span>Explore the assembly</span>
            <span>{info?.systems.length ?? 8} systems</span>
            <button
              className="mobile-close"
              aria-label="Close inspector"
              onClick={() => setMobilePanel(false)}
            >
              <X size={17} />
            </button>
          </div>
          <div className="system-strip">
            {info?.systems.map((s) => (
              <button
                key={s.id}
                title={s.name}
                aria-label={`Explore ${s.name}`}
                aria-pressed={system === s.id}
                className={system === s.id ? 'active' : ''}
                onClick={() => {
                  setSystem(s.id);
                  setPage(60);
                  patch({
                    selected: null,
                    isolated: false,
                    isolatedSystem: null,
                  });
                  viewer.current?.focusSystem(s.id);
                }}
              >
                {{
                  nozzle: 'Nozzle',
                  chamber: 'Chamber',
                  injector: 'Injector',
                  oxygen: 'Oxygen',
                  methane: 'Methane',
                  feed: 'Feed lines',
                  structure: 'Structure',
                  control: 'Controls',
                }[s.id] ?? s.name}
              </button>
            ))}
          </div>
          <div className="selection-detail">
            <p className="detail-kicker">
              {selected
                ? selectedSystem?.name
                : system === 'all'
                  ? 'Engine anatomy'
                  : `System ${String((info?.systems.findIndex((s) => s.id === system) ?? 0) + 1).padStart(2, '0')}`}
            </p>
            <h2>
              {selected?.name ??
                selectedSystem?.name ??
                `Raptor ${settings.generation}`}
            </h2>
            <p className="detail-description">
              {selected
                ? `${selected.group}. ${selected.internal ? 'An illustrative reconstruction of a concealed component.' : 'An individually modeled element of the exterior study.'}`
                : (selectedSystem?.description ??
                  generationCopy[settings.generation].description)}
            </p>
            <div className="detail-rule" />
            <p className="modelled-caption">
              {selected
                ? selected.material.replace(/-/g, ' ')
                : `${info?.parts.length.toLocaleString('en-US') ?? '—'} modeled elements`}
            </p>
            <div className="inspection-actions">
              <button
                disabled={
                  !selected && !selectedSystem && !settings.isolatedSystem
                }
                className={
                  settings.isolated || settings.isolatedSystem ? 'active' : ''
                }
                onClick={() =>
                  selected
                    ? patch({
                        isolated: !settings.isolated,
                        isolatedSystem: null,
                      })
                    : patch({
                        isolatedSystem: settings.isolatedSystem
                          ? null
                          : selectedSystem!.id,
                      })
                }
              >
                <Focus size={15} />
                {settings.isolated || settings.isolatedSystem
                  ? 'Show surrounding parts'
                  : selected
                    ? 'Isolate this part'
                    : 'Isolate this system'}
              </button>
              <div>
                <button
                  disabled={!selected}
                  onClick={() => selected && viewer.current?.focus(selected.id)}
                >
                  Inspect closely
                  <ArrowDownRight size={14} />
                </button>
                <button
                  disabled={reduced}
                  aria-pressed={settings.spin}
                  onClick={() => patch({ spin: !settings.spin })}
                >
                  {settings.spin ? (
                    <Pause size={13} />
                  ) : (
                    <RotateCcw size={13} />
                  )}
                  360° orbit
                </button>
              </div>
            </div>
            {selectedSystem && !selected && (
              <div className="system-separation">
                <label htmlFor="system-separation">
                  Separate this system
                  <output>
                    {Math.round(
                      (settings.systemSeparation[selectedSystem.id] ?? 0) * 100,
                    )}
                    %
                  </output>
                </label>
                <input
                  id="system-separation"
                  type="range"
                  min="0"
                  max="1"
                  step=".001"
                  value={settings.systemSeparation[selectedSystem.id] ?? 0}
                  onChange={(e) =>
                    patch({
                      systemSeparation: {
                        ...settings.systemSeparation,
                        [selectedSystem.id]: +e.target.value,
                      },
                    })
                  }
                />
              </div>
            )}
            {selected && (
              <details className="part-adjustments">
                <summary>
                  Adjust this part
                  <SlidersHorizontal size={14} />
                </summary>
                <div className="adjustment-fields">
                  {(['x', 'y', 'z', 'rx', 'ry', 'rz'] as const).map((key) => (
                    <label key={key}>
                      <span>
                        {key.startsWith('r')
                          ? `Rotate ${key[1].toUpperCase()}`
                          : `Move ${key.toUpperCase()}`}
                      </span>
                      <input
                        type="range"
                        aria-label={`${key.startsWith('r') ? 'Rotate' : 'Move'} selected part ${key.at(-1)?.toUpperCase()}`}
                        min={key.startsWith('r') ? -180 : -3}
                        max={key.startsWith('r') ? 180 : 3}
                        step={key.startsWith('r') ? 1 : 0.01}
                        value={transform[key]}
                        onChange={(e) => modify(key, +e.target.value)}
                      />
                      <output>
                        {transform[key].toFixed(key.startsWith('r') ? 0 : 2)}
                      </output>
                    </label>
                  ))}
                </div>
                <div className="adjustment-buttons">
                  <button
                    onClick={() =>
                      patch({
                        hidden: settings.hidden.includes(selected.id)
                          ? settings.hidden.filter((x) => x !== selected.id)
                          : [...settings.hidden, selected.id],
                      })
                    }
                  >
                    {settings.hidden.includes(selected.id) ? (
                      <Eye size={13} />
                    ) : (
                      <EyeOff size={13} />
                    )}{' '}
                    {settings.hidden.includes(selected.id) ? 'Reveal' : 'Hide'}
                  </button>
                  <button
                    onClick={() =>
                      patch({
                        hidden: settings.hidden.filter(
                          (id) => id !== selected.id,
                        ),
                        transforms: {
                          ...settings.transforms,
                          [selected.id]: { ...zeroTransform },
                        },
                      })
                    }
                  >
                    Restore part
                  </button>
                </div>
              </details>
            )}
          </div>
          <div className="atlas">
            <div className="atlas-heading">
              <h3>Component atlas</h3>
              <span>{info?.groups ?? '—'} groups</span>
            </div>
            <label className="atlas-search">
              <Search size={15} />
              <input
                aria-label="Search components"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(60);
                }}
                placeholder="Find a part, e.g. flange…"
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery('')}>
                  <X size={13} />
                </button>
              )}
            </label>
            <select
              aria-label="Filter by engine system"
              value={system}
              onChange={(e) => {
                setSystem(e.target.value);
                setPage(60);
                patch({ isolatedSystem: null });
              }}
            >
              <option value="all">All systems</option>
              {info?.systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="atlas-results">
              {candidates.slice(0, page).map((p) => (
                <button
                  key={p.id}
                  className={`atlas-part ${settings.selected === p.id ? 'active' : ''} ${settings.hidden.includes(p.id) ? 'part-hidden' : ''}`}
                  onClick={() => pick(p.id, true)}
                >
                  <span>{p.name}</span>
                  {settings.selected === p.id ? (
                    <Check size={13} />
                  ) : (
                    <ArrowUpRight size={12} />
                  )}
                </button>
              ))}
              {ready && candidates.length === 0 && (
                <p className="empty-atlas">
                  No matching components. Try a broader name or another system.
                </p>
              )}
              {candidates.length > page && (
                <button
                  className="load-parts"
                  onClick={() => setPage(page + 60)}
                >
                  Show 60 more<span>{candidates.length - page} remaining</span>
                </button>
              )}
            </div>
          </div>
          <div className="inspector-foot">
            Visual reconstruction from public references.
            <button onClick={() => setReference(true)}>
              View sources
              <ArrowUpRight size={12} />
            </button>
          </div>
        </aside>
        <section className="assembly-controls" aria-label="Assembly controls">
          <div className="separation-control">
            <label htmlFor="assembly-separation">
              Assembly separation
              <output>{Math.round(settings.separation * 100)}%</output>
            </label>
            <input
              id="assembly-separation"
              type="range"
              min="0"
              max="1"
              step=".001"
              value={settings.separation}
              onChange={(e) => {
                setMotion(false);
                motionElapsed.current = 0;
                patch({ separation: +e.target.value });
              }}
            />
            <div>
              <span>Assembled</span>
              <span>Exploded</span>
            </div>
          </div>
          <div className="separation-control">
            <label htmlFor="internal-detail">
              Component spread
              <output>{Math.round(settings.detail * 100)}%</output>
            </label>
            <input
              id="internal-detail"
              type="range"
              min="0"
              max="1"
              step=".001"
              value={settings.detail}
              onChange={(e) => {
                setMotion(false);
                motionElapsed.current = 0;
                patch({ detail: +e.target.value });
              }}
            />
            <div>
              <span>Nested</span>
              <span>Spread</span>
            </div>
          </div>
          <div className="motion-control">
            <button
              disabled={!ready || reduced}
              aria-pressed={motion}
              aria-label={
                motion ? 'Pause assembly animation' : 'Play assembly animation'
              }
              onClick={() => setMotion(!motion)}
            >
              {motion ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <span>{motion ? 'Pause sequence' : 'Animate assembly'}</span>
          </div>
        </section>
      </div>
      {toast && <output className="workspace-toast">{toast}</output>}
      <dialog
        ref={dialog}
        className="reference-dialog"
        aria-labelledby="reference-title"
        onCancel={(e) => {
          e.preventDefault();
          setReference(false);
        }}
      >
        <button
          autoFocus
          className="dialog-close"
          aria-label="Close model information"
          onClick={() => setReference(false)}
        >
          <X size={20} />
        </button>
        <span className="detail-kicker">Reference & reconstruction</span>
        <h2 id="reference-title">A study of three generations.</h2>
        <p>
          These interactive models interpret SpaceX’s published Raptor
          photographs. Exterior silhouettes and visible packaging changes guide
          the reconstruction.
        </p>
        <p>
          Concealed components, small fasteners and the exploded arrangement are
          illustrative. This is not official SpaceX CAD, a manufacturing model
          or a verified inventory of engine parts.
        </p>
        <div className="reference-links">
          <a
            href="https://x.com/SpaceX/status/1819795288116330594"
            target="_blank"
            rel="noreferrer"
          >
            SpaceX · Raptor 1, 2 and 3 portraits
            <ArrowUpRight size={15} />
          </a>
          <a
            href="https://x.com/SpaceX/status/1819772716339339664"
            target="_blank"
            rel="noreferrer"
          >
            SpaceX · Three-generation comparison
            <ArrowUpRight size={15} />
          </a>
          <a
            href="https://www.spacex.com/vehicles/starship/"
            target="_blank"
            rel="noreferrer"
          >
            SpaceX · Starship
            <ArrowUpRight size={15} />
          </a>
        </div>
        <p className="reference-small">
          Model counts refer to elements in this visualization. Cleaner external
          packaging does not establish an exact total part count. Finish names
          describe visual appearance rather than verified alloy composition.
        </p>
      </dialog>
    </main>
  );
}
