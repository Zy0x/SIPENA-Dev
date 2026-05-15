# Scroll Integration Design

## 1. Core Logic (Single Flow Behavior)
The system will intercept `wheel` and `touch` events on the inner scroll container (Table) and decide whether to consume the event or let it bubble to the parent (Page).

### Vertical Scroll Priority
- **Scroll Down (deltaY > 0):**
  - If `scrollTop + clientHeight < scrollHeight` (not at bottom): Scroll table, `preventDefault()`.
  - If `scrollTop + clientHeight >= scrollHeight` (at bottom): Let event pass to page.
- **Scroll Up (deltaY < 0):**
  - If `scrollTop > 0` (not at top): Scroll table, `preventDefault()`.
  - If `scrollTop <= 0` (at top): Let event pass to page.

### Horizontal Scroll Priority
- **Horizontal Interaction (deltaX != 0):**
  - If `scrollLeft` is not at the requested edge: Scroll table horizontally, `preventDefault()`.
  - If `scrollLeft` is at the edge: Allow vertical page scroll (if applicable).

## 2. Implementation Strategy
- **Custom Hook (`useScrollIntegration`):** A reusable hook that attaches event listeners to a ref.
- **Event Handling:** Use `passive: false` for event listeners to allow `preventDefault()`.
- **Edge Case Handling:** 
  - Precision issues (using a 1px threshold).
  - Trackpad vs Mouse Wheel (handling both `deltaX` and `deltaY`).
  - Hover state: Logic only triggers when the cursor is over the element.

## 3. Modular Approach
The hook will return a `ref` to be attached to the `SmartScrollTable` container.

```typescript
function useScrollIntegration() {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Logic implementation...
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return ref;
}
```
