/**
 * Zoom plugin
 *
 * Zoom in or out on the waveform when scrolling the mouse wheel
 *
 * @author HoodyHuo (https://github.com/HoodyHuo)
 * @author Chris Morbitzer (https://github.com/cmorbitzer)
 * @author Sam Hulick (https://github.com/ffxsam)
 * @author Gustav Sollenius (https://github.com/gustavsollenius)
 * @author Viktor Jevdokimov (https://github.com/vitar)
 *
 * @example
 * // ... initialising wavesurfer with the plugin
 * var wavesurfer = WaveSurfer.create({
 *   // wavesurfer options ...
 *   plugins: [
 *     ZoomPlugin.create({
 *       // plugin options ...
 *     })
 *   ]
 * });
 */
import { BasePlugin } from '../base-plugin.js';
import { effect } from '../reactive/store.js';
import { fromEvent } from '../reactive/event-streams.js';
const defaultOptions = {
    scale: 0.5,
    deltaThreshold: 5,
    exponentialZooming: false,
    iterations: 20,
};
class ZoomPlugin extends BasePlugin {
    constructor(options) {
        super(options || {});
        this.wrapper = undefined;
        this.container = null;
        // State for wheel zoom
        this.accumulatedDelta = 0;
        this.pointerTime = 0;
        this.oldX = 0;
        this.endZoom = 0;
        this.startZoom = 0;
        // State for proportional pinch-to-zoom
        this.isPinching = false;
        this.initialPinchDistance = 0;
        this.initialZoom = 0;
        this.onWheel = (e) => {
            if (!this.wavesurfer || !this.container || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
                return;
            }
            // prevent scrolling the sidebar while zooming
            e.preventDefault();
            // Update the accumulated delta...
            this.accumulatedDelta += -e.deltaY;
            if (this.startZoom === 0 && this.options.exponentialZooming) {
                this.startZoom = this.wavesurfer.getWrapper().clientWidth / this.wavesurfer.getDuration();
            }
            // ...and only scroll once we've hit our threshold
            if (this.options.deltaThreshold === 0 || Math.abs(this.accumulatedDelta) >= this.options.deltaThreshold) {
                const duration = this.wavesurfer.getDuration();
                const oldMinPxPerSec = this.wavesurfer.options.minPxPerSec === 0
                    ? this.wavesurfer.getWrapper().scrollWidth / duration
                    : this.wavesurfer.options.minPxPerSec;
                const x = e.clientX - this.container.getBoundingClientRect().left;
                const width = this.container.clientWidth;
                const scrollX = this.wavesurfer.getScroll();
                // Update pointerTime only if the pointer position has changed. This prevents the waveform from drifting during fixed zooming.
                if (x !== this.oldX || this.oldX === 0) {
                    this.pointerTime = (scrollX + x) / oldMinPxPerSec;
                }
                this.oldX = x;
                const newMinPxPerSec = this.calculateNewZoom(oldMinPxPerSec, this.accumulatedDelta);
                const newLeftSec = (width / newMinPxPerSec) * (x / width);
                if (newMinPxPerSec * duration < width) {
                    this.wavesurfer.zoom(width / duration);
                    this.container.scrollLeft = 0;
                }
                else {
                    this.wavesurfer.zoom(newMinPxPerSec);
                    this.container.scrollLeft = (this.pointerTime - newLeftSec) * newMinPxPerSec;
                }
                // Reset the accumulated delta
                this.accumulatedDelta = 0;
            }
        };
        this.calculateNewZoom = (oldZoom, delta) => {
            let newZoom;
            if (this.options.exponentialZooming) {
                const zoomFactor = delta > 0
                    ? Math.pow(this.endZoom / this.startZoom, 1 / (this.options.iterations - 1))
                    : Math.pow(this.startZoom / this.endZoom, 1 / (this.options.iterations - 1));
                newZoom = Math.max(0, oldZoom * zoomFactor);
            }
            else {
                // Default linear zooming
                newZoom = Math.max(0, oldZoom + delta * this.options.scale);
            }
            return Math.min(newZoom, this.options.maxZoom);
        };
        this.onTouchStart = (e) => {
            if (!this.wavesurfer || !this.container)
                return;
            // Check if two fingers are used
            if (e.touches.length === 2) {
                e.preventDefault();
                this.isPinching = true;
                // Store initial pinch distance
                this.initialPinchDistance = this.getTouchDistance(e);
                // Store initial zoom level
                const duration = this.wavesurfer.getDuration();
                this.initialZoom =
                    this.wavesurfer.options.minPxPerSec === 0
                        ? this.wavesurfer.getWrapper().scrollWidth / duration
                        : this.wavesurfer.options.minPxPerSec;
                // Store anchor point for zooming
                const x = this.getTouchCenterX(e) - this.container.getBoundingClientRect().left;
                const scrollX = this.wavesurfer.getScroll();
                this.pointerTime = (scrollX + x) / this.initialZoom;
                this.oldX = x; // Use oldX to store the anchor X position
            }
        };
        this.onTouchMove = (e) => {
            if (!this.isPinching || e.touches.length !== 2 || !this.wavesurfer || !this.container) {
                return;
            }
            e.preventDefault();
            // Calculate new zoom level
            const newDistance = this.getTouchDistance(e);
            const scaleFactor = newDistance / this.initialPinchDistance;
            let newMinPxPerSec = this.initialZoom * scaleFactor;
            // Constrain the zoom
            newMinPxPerSec = Math.min(newMinPxPerSec, this.options.maxZoom);
            // Calculate minimum zoom (fit to width)
            const duration = this.wavesurfer.getDuration();
            const width = this.container.clientWidth;
            const minZoom = width / duration;
            if (newMinPxPerSec < minZoom) {
                newMinPxPerSec = minZoom;
            }
            // Apply zoom and scroll
            const newLeftSec = (width / newMinPxPerSec) * (this.oldX / width);
            if (newMinPxPerSec === minZoom) {
                this.wavesurfer.zoom(minZoom);
                this.container.scrollLeft = 0;
            }
            else {
                this.wavesurfer.zoom(newMinPxPerSec);
                this.container.scrollLeft = (this.pointerTime - newLeftSec) * newMinPxPerSec;
            }
        };
        this.onTouchEnd = (e) => {
            if (this.isPinching && e.touches.length < 2) {
                this.isPinching = false;
                this.initialPinchDistance = 0;
                this.initialZoom = 0;
            }
        };
        this.options = Object.assign({}, defaultOptions, options);
    }
    static create(options) {
        return new ZoomPlugin(options);
    }
    onInit() {
        var _a, _b;
        this.wrapper = (_a = this.wavesurfer) === null || _a === void 0 ? void 0 : _a.getWrapper();
        if (!this.wrapper) {
            return;
        }
        this.container = this.wrapper.parentElement;
        if (typeof this.options.maxZoom === 'undefined') {
            this.options.maxZoom = this.container.clientWidth;
        }
        this.endZoom = this.options.maxZoom;
        // Get reactive state
        const state = (_b = this.wavesurfer) === null || _b === void 0 ? void 0 : _b.getState();
        // React to zoom state changes to update internal state
        if (state) {
            this.subscriptions.push(effect(() => {
                const zoom = state.zoom.value;
                if (zoom > 0 && this.startZoom === 0 && this.options.exponentialZooming) {
                    const duration = state.duration.value;
                    if (duration > 0 && this.container) {
                        this.startZoom = this.container.clientWidth / duration;
                    }
                }
            }, [state.zoom, state.duration]));
        }
        // Create event streams
        const wheelStream = fromEvent(this.container, 'wheel');
        const touchStartStream = fromEvent(this.container, 'touchstart');
        const touchMoveStream = fromEvent(this.container, 'touchmove');
        const touchEndStream = fromEvent(this.container, 'touchend');
        const touchCancelStream = fromEvent(this.container, 'touchcancel');
        // React to wheel events
        this.subscriptions.push(effect(() => {
            const e = wheelStream.value;
            if (e)
                this.onWheel(e);
        }, [wheelStream]));
        // React to touch events
        this.subscriptions.push(effect(() => {
            const e = touchStartStream.value;
            if (e)
                this.onTouchStart(e);
        }, [touchStartStream]));
        this.subscriptions.push(effect(() => {
            const e = touchMoveStream.value;
            if (e)
                this.onTouchMove(e);
        }, [touchMoveStream]));
        this.subscriptions.push(effect(() => {
            const e = touchEndStream.value;
            if (e)
                this.onTouchEnd(e);
        }, [touchEndStream]));
        this.subscriptions.push(effect(() => {
            const e = touchCancelStream.value;
            if (e)
                this.onTouchEnd(e);
        }, [touchCancelStream]));
    }
    getTouchDistance(e) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        return Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2));
    }
    getTouchCenterX(e) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        return (touch1.clientX + touch2.clientX) / 2;
    }
    destroy() {
        super.destroy();
    }
}
export default ZoomPlugin;
