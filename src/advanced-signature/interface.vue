<template>
	<div class="signature-interface">
		<!-- Display state: Shows the existing signature -->
		<div v-if="value && value.image" class="preview-container">
			<div class="image-wrapper">
				<img :src="value.image" class="signature-preview" />
			</div>
			<div class="meta-info">
				<div class="meta-row">
					<v-icon name="person" x-small />
					<span>{{ userName }}</span>
				</div>
				<div class="meta-row">
					<v-icon name="schedule" x-small />
					<span>{{ formatTime(value.timestamp) }}</span>
				</div>
			</div>
			<v-button kind="danger" outline full-width @click="clearSignature">
				<v-icon name="delete" /> {{ translate('clear_signature') }}
			</v-button>
		</div>

		<!-- Input state: Awaits a new signature -->
		<div v-else class="input-container">
			<div class="tabs">
				<button :class="['tab-btn', { active: mode === 'pad' }]" @click="switchMode('pad')">
					<v-icon name="edit" small /> {{ translate('online_writing') }}
				</button>
				<button :class="['tab-btn', { active: mode === 'qr' }]" @click="switchMode('qr')">
					<v-icon name="qr_code_2" small /> {{ translate('mobile_scan') }}
				</button>
			</div>

			<!-- Mode 1: Local Canvas Pad -->
			<div v-show="mode === 'pad'" class="pad-area">
				<canvas ref="canvasRef" class="local-canvas"></canvas>
				<div class="actions">
					<v-button kind="secondary" x-small @click="undo" :disabled="isEmpty">
						<v-icon name="undo" x-small />
					</v-button>
					<v-button kind="secondary" x-small @click="clearPad">{{ translate('rewrite') }}</v-button>
					<v-button x-small @click="savePad">{{ translate('confirm_use') }}</v-button>
				</div>
			</div>

			<!-- Mode 2: QR Code for Mobile Signing -->
			<div v-show="mode === 'qr'" class="qr-area">
				<div v-if="qrCodeUrl" class="qr-content">
					<div class="qr-frame">
						<qrcode-vue :value="qrCodeUrl" :size="180" level="H" render-as="svg" />
					</div>
					<p class="instruction">{{ translate('scan_instruction') }}</p>
					<div class="status-box">
						<template v-if="polling">
							<v-progress-circular indeterminate x-small />
							<span>{{ translate('waiting_mobile') }}</span>
						</template>
						<template v-else>
							<span class="error">{{ translate('connection_lost') }}</span>
							<a @click="generateSession">{{ translate('refresh') }}</a>
						</template>
					</div>
				</div>
				<div v-else class="loading-state">
					<v-progress-circular indeterminate />
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useStores, useApi } from '@directus/extensions-sdk';
import { getTranslate } from "../locales/i18n";
import SmoothSignature from 'smooth-signature';
import QrcodeVue from 'qrcode.vue';

/**
 * @what This function initializes the internationalization (i18n) service.
 * @why To provide multi-language support for the component's UI text.
 * @who The component's setup script.
 * @when Immediately upon component setup.
 * @where It's called at the top level of the <script setup> block.
 * @how It calls the getTranslate function from the i18n module, which detects the browser's language and returns the appropriate translation function.
 */
const translate = getTranslate();

/**
 * @what Defines the component's props.
 * @prop {String} field - The unique name of the field in the Directus data model. Used to create unique IDs.
 * @prop {Object} value - The current value of the field, which is a JSON object containing the signature data.
 */
const props = defineProps({
	field: String,
	value: { type: Object, default: null },
});

/**
 * @what Defines the custom events emitted by the component.
 * @event input - Emitted when the signature data changes.
 */
const emit = defineEmits(['input']);

// --- Dependency Injection ---
const api = useApi();
const stores = useStores();
const userStore = stores.useUserStore();

// --- Component State ---
const currentUser = computed(() => userStore.currentUser);
const mode = ref('pad');
const canvasRef = ref(null);
const signatureInstance = shallowRef(null);
const isEmpty = ref(true);
const sessionId = ref(null);
const qrCodeUrl = ref('');
const polling = ref(false);
const pollTimer = ref(null);

/**
 * @what A computed property that returns the full name of the current user.
 * @why To display the signer's name in the UI and to embed it in the saved signature data.
 * @who The component's template and the emitValue function.
 * @when The currentUser state changes or when a signature is saved.
 * @where It accesses the userStore provided by the Directus SDK.
 * @how It combines the first_name and last_name from the currentUser object, with fallbacks to email or 'Unknown'.
 */
const userName = computed(() => {
	if (!currentUser.value) return 'System User';
	return `${currentUser.value.first_name || ''} ${currentUser.value.last_name || ''}`.trim() || currentUser.value.email;
});

/**
 * @what Initializes or re-initializes the SmoothSignature canvas instance.
 * @why To prepare the canvas for drawing, ensuring it has the correct dimensions and settings.
 * @who Called by onMounted, switchMode, and clearPad functions.
 * @when The component is first mounted, when switching to 'pad' mode, or when clearing the pad.
 * @where It targets the <canvas> element referenced by canvasRef.
 * @how It gets the canvas dimensions, sets up options (like color, width), and creates a new SmoothSignature instance. It also handles high-DPI scaling.
 */
const initCanvas = async () => {
	await nextTick();
	if (!canvasRef.value) return;

	const canvas = canvasRef.value;
	const rect = canvas.getBoundingClientRect();
	if (rect.width === 0) return;

	signatureInstance.value = null; // Destroy old instance

	canvas.width = rect.width * (window.devicePixelRatio || 2);
	canvas.height = 200 * (window.devicePixelRatio || 2);
	canvas.style.width = `${rect.width}px`;
	canvas.style.height = '200px';

	const options = {
		width: rect.width,
		height: 200,
		scale: window.devicePixelRatio || 2,
		minWidth: 2,
		maxWidth: 6,
		color: '#000000',
		onStart: () => { isEmpty.value = false; },
	};
	
	try {
		signatureInstance.value = new SmoothSignature(canvas, options);
		isEmpty.value = true;
	} catch (err) {
		console.error("Init failed:", err);
	}
};

/**
 * @what Undoes the last stroke drawn on the canvas.
 * @how It calls the undo() method of the SmoothSignature instance.
 */
const undo = () => {
	if (signatureInstance.value) {
		signatureInstance.value.undo();
		isEmpty.value = signatureInstance.value.isEmpty();
	}
};

/**
 * @what Clears the current drawing on the canvas and resets its history.
 * @how It calls the clear() method and then re-initializes the canvas to ensure a clean state.
 */
const clearPad = () => {
	if (signatureInstance.value) {
		signatureInstance.value.clear();
		isEmpty.value = true;
		initCanvas();
	}
};

/**
 * @what Clears the saved signature data and resets the component to its initial input state.
 * @why To allow the user to remove a previously saved signature.
 * @how It emits a `null` value to Directus, switches the mode back to 'pad', and re-initializes the canvas.
 */
const clearSignature = async () => {
	emit('input', null);
	mode.value = 'pad';
	await nextTick();
	setTimeout(initCanvas, 50);
};

/**
 * @what Saves the current drawing on the canvas as a Base64 PNG.
 * @how It calls the getPNG() method of the SmoothSignature instance and passes the result to emitValue.
 */
const savePad = () => {
	if (!signatureInstance.value || signatureInstance.value.isEmpty()) return;
	const base64 = signatureInstance.value.getPNG();
	emitValue(base64);
};

/**
 * @what Emits the signature data to be saved by Directus.
 * @why To persist the signature in the database.
 * @who Called by savePad (from PC) or startPolling (from mobile).
 * @when A signature is confirmed.
 * @how It constructs a JSON payload with the image, signer's ID, name, and timestamp, then calls `emit('input', ...)`.
 */
const emitValue = (base64Image) => {
	emit('input', {
		image: base64Image,
		signed_by: currentUser.value?.id,
		signed_by_name: userName.value,
		timestamp: Date.now()
	});
};

/**
 * @what Switches the component between 'pad' (online writing) and 'qr' (mobile scan) modes.
 * @how It updates the `mode` ref and triggers the appropriate logic (initCanvas or generateSession).
 */
const switchMode = (newMode) => {
	mode.value = newMode;
	if (newMode === 'qr') {
		if (!polling.value) generateSession();
	} else {
		stopPolling();
		setTimeout(initCanvas, 100);
	}
};

/**
 * @what Generates a unique session ID and QR code URL for mobile signing.
 * @how It creates a random string, combines it with the public URL, and starts the polling process.
 */
const generateSession = () => {
	sessionId.value = `${props.field}-${Math.random().toString(36).substring(2, 10)}`;
	const baseUrl = window.location.origin;
	qrCodeUrl.value = `${baseUrl}/signature-bridge/page/${sessionId.value}`;
	startPolling();
};

/**
 * @what Starts periodically checking the backend endpoint for a submitted mobile signature.
 * @why To achieve real-time data transfer from the mobile device back to the PC.
 * @how It uses `setInterval` to call an API endpoint every 2 seconds until a signature is found.
 */
const startPolling = () => {
	stopPolling();
	polling.value = true;
	pollTimer.value = setInterval(async () => {
		try {
			const res = await api.get(`/signature-bridge/check/${sessionId.value}`);
			if (res.data.status === 'completed' && res.data.signature) {
				emitValue(res.data.signature);
				stopPolling();
			}
		} catch (e) { /* ignore */ }
	}, 2000);
};

/**
 * @what Stops the polling process.
 * @how It clears the interval timer set by startPolling.
 */
const stopPolling = () => {
	polling.value = false;
	if (pollTimer.value) clearInterval(pollTimer.value);
};

/**
 * @what Formats a Unix timestamp into a human-readable local date and time string.
 * @how It uses the `Date` object's `toLocaleString()` method.
 */
const formatTime = (ts) => new Date(ts).toLocaleString();

// --- Lifecycle Hooks ---
onMounted(() => {
	if (!props.value) setTimeout(initCanvas, 100);
});

onUnmounted(() => {
	stopPolling();
});
</script>

<style scoped>
.signature-interface {
	border: var(--theme--form--field--input--border-width) solid var(--theme--form--field--input--border-color);
	border-radius: var(--theme--border-radius);
	padding: 16px;
	background: var(--theme--background);
	transition: border-color var(--theme--transition-duration) var(--theme--transition-timing);
}

.preview-container {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.image-wrapper {
	background: #fff;
	border: 1px solid var(--theme--border-color-subdued);
	border-radius: var(--theme--border-radius);
	padding: 12px;
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 120px;
	box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
}

.signature-preview {
	max-height: 120px;
	max-width: 100%;
	object-fit: contain;
}

.meta-info {
	display: flex;
	gap: 16px;
	font-size: 12px;
	color: var(--theme--foreground-subdued);
	background: var(--theme--background-subdued);
	padding: 10px;
	border-radius: var(--theme--border-radius);
	margin-bottom: 12px;
	border: 1px solid var(--theme--border-color-subdued);
}

.meta-row {
	display: flex;
	align-items: center;
	gap: 6px;
}

/* 输入区域 */
.tabs {
	display: flex;
	gap: 8px;
	margin-bottom: 12px;
	border-bottom: 1px solid var(--theme--border-color-subdued);
	padding-bottom: 8px;
}

.tab-btn {
	background: none;
	border: none;
	cursor: pointer;
	padding: 6px 12px;
	border-radius: 4px;
	color: var(--theme--foreground-subdued);
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 13px;
	transition: all 0.2s;
}

.tab-btn:hover {
	background: var(--theme--background-subdued);
}

.tab-btn.active {
	background: var(--theme--primary-background);
	color: var(--theme--primary);
	font-weight: 600;
}

.pad-area {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.local-canvas {
	width: 100%;
	height: 200px;
	background: #fff;
	border: 2px solid var(--theme--border-color-subdued);
	border-radius: var(--theme--border-radius);
	cursor: crosshair;
	touch-action: none;
	transition: border-color 0.2s ease;
}

.local-canvas:hover {
	border-color: var(--theme--border-color);
}

.actions {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}

.qr-area {
	display: flex;
	justify-content: center;
	padding: 20px 0;
}

.qr-content {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	gap: 12px;
}

.qr-frame {
	padding: 16px;
	background: #fff;
	border: 1px solid var(--theme--border-color-subdued);
	border-radius: 12px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.instruction {
	font-size: 14px;
	color: var(--theme--foreground);
	font-weight: 500;
}

.status-box {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
	color: var(--theme--foreground-subdued);
}
</style>
