import { HTMLContainer, Rectangle2d, ShapeUtil, T, resizeBox, type TLShape } from 'tldraw'

// Same "artifact = a tile rendered by kind" idea as the React Flow version, but
// expressed as a tldraw custom shape. Everything else (grouping, frames, text,
// sticky notes, arrows, select/resize/align/snap) comes from tldraw for free.
// Canonical v5 pattern: register the custom shape's props in the global map
// (single source of truth), then derive the shape type from TLShape.
declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    artifact: { w: number; h: number; tileId: string; kind: string; title: string; entry: string }
  }
}

export type ArtifactShape = Extract<TLShape, { type: 'artifact' }>

const KIND: Record<string, string> = { html: 'HTML', spa: 'SPA', document: 'Document', app: 'Server' }

export class ArtifactShapeUtil extends ShapeUtil<ArtifactShape> {
  static override type = 'artifact' as const
  static override props = {
    w: T.number,
    h: T.number,
    tileId: T.string,
    kind: T.string,
    title: T.string,
    entry: T.string,
  }

  getDefaultProps(): ArtifactShape['props'] {
    return { w: 400, h: 300, tileId: '', kind: 'html', title: 'Tile', entry: 'index.html' }
  }

  getGeometry(shape: ArtifactShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override canResize = () => true
  override onResize = (shape: ArtifactShape, info: any) => resizeBox(shape, info)
  // double-click a tile to "enter" it (edit mode); also stops double-click from
  // dropping a stray text label on the shape
  override canEdit = () => true

  getIndicatorPath(shape: ArtifactShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  component(shape: ArtifactShape) {
    const { tileId, kind, title, entry } = shape.props
    // reactive reads: tldraw re-renders the component when editing/hover changes
    const isEditing = this.editor.getEditingShapeId() === shape.id
    const isHovered = this.editor.getHoveredShapeId() === shape.id
    const live = kind !== 'app' && isEditing
    return (
      <HTMLContainer>
        {/* card is pointerEvents:none so tldraw owns select/drag/group; when the
            shape is being edited, the iframe re-enables its own pointer events */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(0,0,0,.1)',
            boxShadow: isEditing
              ? '0 0 0 2px #4b7bd6, 0 12px 32px -14px rgba(0,0,0,.45)'
              : '0 12px 32px -14px rgba(0,0,0,.4)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 34,
              flex: '0 0 34px',
              padding: '0 11px',
              background: '#f6f6f7',
              borderBottom: '1px solid rgba(0,0,0,.07)',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c4c4c9' }} />
            <span
              style={{
                fontWeight: 600,
                fontSize: 12,
                color: '#1a1a1d',
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                color: '#5b5b62',
                background: 'rgba(0,0,0,.06)',
                padding: '3px 7px',
                borderRadius: 999,
              }}
            >
              {KIND[kind] ?? kind}
            </span>
          </div>
          <div style={{ flex: '1 1 auto', position: 'relative', overflow: 'hidden' }}>
            {kind === 'app' ? (
              <div
                style={{
                  height: '100%',
                  background: 'linear-gradient(160deg,#26262b,#161619)',
                  color: '#e8e8ea',
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div style={{ fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase', color: '#4b7bd6', marginBottom: 10 }}>
                  ● full-stack tier
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
                  Lazy-spawned local process, reverse-proxied. Spike pending.
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', height: '100%', position: 'relative', pointerEvents: live ? 'all' : 'none' }}>
                <iframe
                  src={`/_artifact/${tileId}/`}
                  title={title}
                  style={{ width: '100%', height: '100%', border: 0, pointerEvents: live ? 'all' : 'none' }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
                {!isEditing && isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#1a1a1d',
                      background: 'rgba(255,255,255,.92)',
                      border: '1px solid rgba(0,0,0,.12)',
                      padding: '4px 10px',
                      borderRadius: 999,
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    double-click to use
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </HTMLContainer>
    )
  }
}
