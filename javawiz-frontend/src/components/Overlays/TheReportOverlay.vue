<template>
  <Overlay :show="overlayStore.showReport" title="Report Issue / Suggestion" @close-dialog="hide">
    <form v-if="!submitSuccess" class="report-form" @submit.prevent="submitReport">
      <!-- Report Type -->
      <div class="form-group">
        <label for="reportType">Type: <span class="required">*</span></label>
        <select id="reportType" v-model="reportType" required>
          <option disabled value="">
            Please select one
          </option>
          <option value="Bug report">
            Bug report
          </option>
          <option value="Feature Request">
            Feature Request
          </option>
          <option value="Question">
            Question
          </option>
        </select>
        <small v-if="attemptedSubmit && !reportType" class="error-message">Type is required.</small>
      </div>

      <!-- Title -->
      <div class="form-group">
        <label for="title">Title: <span class="required">*</span></label>
        <input
          id="title" v-model.trim="title" type="text" required
          minlength="1" placeholder="Short summary of the issue/request">
        <small v-if="attemptedSubmit && !title" class="error-message">Title is required.</small>
      </div>

      <!-- Name -->
      <div class="form-group">
        <label for="name">Your Name: <span class="required">*</span></label>
        <input
          id="name" v-model.trim="name" type="text" required
          minlength="1" placeholder="So we know who to thank/contact">
        <small v-if="attemptedSubmit && !name" class="error-message">Name is required.</small>
      </div>

      <!-- Email -->
      <div class="form-group">
        <label for="email">Your Email: <span class="required">*</span></label>
        <input
          id="email" v-model.trim="email" type="email" required
          placeholder="For potential follow-up questions">
        <small v-if="attemptedSubmit && !isValidEmail" class="error-message">A valid email address is required.</small>
      </div>

      <!-- Report Markdown + Preview -->
      <div class="form-group markdown-group">
        <label for="reportMarkdown">Details (Markdown supported): <span class="required">*</span> ({{ reportMarkdown.length }} / 2000)</label>
        <div class="markdown-editor">
          <textarea
            id="reportMarkdown"
            v-model="reportMarkdown"
            required
            minlength="1"
            maxlength="2000"
            placeholder="Describe the bug, feature, or question in detail. You can use Markdown for formatting."
            rows="8" />
          <div class="markdown-preview" v-html="markdownPreview" />
        </div>
        <small v-if="attemptedSubmit && reportMarkdown.length === 0" class="error-message">Details are required.</small>
        <small v-if="reportMarkdown.length > 2000" class="error-message">Details cannot exceed 2000 characters.</small>
      </div>

      <!-- File Upload -->
      <!--
      <div class="form-group">
        <label for="files">Attach Images (PNG/JPG, max 6):</label>
        <input
          id="files"
          type="file"
          multiple
          accept=".png, .jpg, .jpeg"
          @change="handleFileChange">
        <small v-if="fileError" class="error-message">{{ fileError }}</small>
        <ul v-if="selectedFiles.length > 0" class="file-list">
          <li v-for="file in selectedFiles" :key="file.name">
            {{ file.name }} ({{ (file.size / 1024).toFixed(1) }} KB)
          </li>
        </ul>
      </div>
      -->

      <!-- Submission Area -->
      <div class="submission-area">
        <button type="submit" :disabled="isSubmitting || !isFormValid">
          {{ isSubmitting ? 'Submitting...' : 'Submit Report' }}
        </button>
        <small v-if="attemptedSubmit && !isFormValid && !isSubmitting" class="error-message general-error">Please fix the errors above.</small>
        <small v-if="submitError" class="error-message general-error">{{ submitError }}</small>
      </div>
    </form>

    <!-- Success Message -->
    <div v-if="submitSuccess" class="success-message">
      <h3>Thank You!</h3>
      <p>Your report has been submitted successfully.</p>
      <button @click="closeAndReset">
        Close
      </button>
    </div>
  </Overlay>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineComponent } from 'vue'
import { marked } from 'marked' // Install: npm install marked @types/marked
import Overlay from '@/components/Overlays/Overlay.vue'
import { useOverlayStore } from '@/store/OverlayStore' // Assuming path

/**
 * IMPORTANT: Image Upload Placeholder
 * This function simulates uploading an image and returning a URL.
 * In a real application, you would replace this with a call to your
 * backend or a third-party image hosting service API (e.g., Imgur).
 */
async function uploadImage(file: File): Promise<string> {
  console.warn(`Image Upload Simulation: Uploading ${file.name}. Replace 'uploadImage' with actual implementation.`);
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  // Return a placeholder URL (e.g., using a blob URL for local testing or a fixed dummy URL)
  // return URL.createObjectURL(file); // Temporary local URL, won't work on Discord
  return `https://via.placeholder.com/150/0000FF/FFFFFF?text=Uploaded+${encodeURIComponent(file.name.substring(0, 10))}`; // Dummy URL
}

defineComponent({
  name: 'TheReportOverlay',
  components: { Overlay }
})

const overlayStore = useOverlayStore()

// Form State
const reportType = ref<'Bug report' | 'Feature Request' | 'Question' | ''>('');
const title = ref('');
const name = ref('');
const email = ref('');
const reportMarkdown = ref('');
const selectedFiles = ref<File[]>([]);
const fileError = ref<string | null>(null);

// Submission State
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);
const submitSuccess = ref(false);
const attemptedSubmit = ref(false); // Track if submit was clicked, for showing validation errors

// --- Computed Properties ---

const markdownPreview = computed(() => {
  // Basic sanitization (consider a more robust sanitizer like DOMPurify in production)
  return marked.parse(reportMarkdown.value, { breaks: true, gfm: true });
});

const isValidEmail = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.value);
});

const isFormValid = computed(() => {
  return !!reportType.value &&
    title.value.length > 0 &&
    name.value.length > 0 &&
    isValidEmail.value &&
    reportMarkdown.value.length > 0 &&
    reportMarkdown.value.length <= 2000 &&
    !fileError.value // Ensure no file validation errors exist
});

// --- Methods ---

function hide() {
  // Don't reset form on simple close, only on successful submit or explicit reset
  overlayStore.showReport = false; // Assumes showReport exists in store
}

function resetForm() {
  reportType.value = '';
  title.value = '';
  name.value = '';
  email.value = '';
  reportMarkdown.value = '';
  selectedFiles.value = [];
  fileError.value = null;
  isSubmitting.value = false;
  submitError.value = null;
  submitSuccess.value = false;
  attemptedSubmit.value = false;
  // Reset the file input visually if possible (trickier without direct DOM manipulation or component key change)
  const fileInput = document.getElementById('files') as HTMLInputElement | null;
  if (fileInput) {
    fileInput.value = '';
  }
}

function closeAndReset() {
  resetForm();
  hide();
}

function _handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  fileError.value = null; // Reset error on new selection
  const files = Array.from(input.files || []);

  // Limit number of files
  if (files.length > 6) {
    fileError.value = 'You can upload a maximum of 6 images.';
    selectedFiles.value = []; // Clear selection
    input.value = ''; // Clear the input visually
    return;
  }

  // Validate file types (redundant with 'accept' but good practice)
  const allowedTypes = ['image/png', 'image/jpeg'];
  const invalidFiles = files.filter(file => !allowedTypes.includes(file.type));
  if (invalidFiles.length > 0) {
    fileError.value = `Invalid file type(s): ${invalidFiles.map(f => f.name).join(', ')}. Only PNG and JPG are allowed.`;
    selectedFiles.value = [];
    input.value = '';
    return;
  }

  selectedFiles.value = files;
}

async function submitReport() {
  attemptedSubmit.value = true; // Mark that submission was attempted
  if (!isFormValid.value) {
    submitError.value = 'Please correct the errors in the form before submitting.';
    return;
  }

  isSubmitting.value = true;
  submitError.value = null;
  submitSuccess.value = false;

  try {
    // 1. Upload Images
    const imageUrls = await Promise.all(selectedFiles.value.map(file => uploadImage(file)));

    // 2. Prepare Timestamps
    const now = new Date();
    const submissionDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const submissionTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); // HH:MM
    const timestampISO = now.toISOString(); // Full ISO 8601 for embed

    // 3. Construct Discord Payload
    const webhookUrl = 'https://discord.com/api/webhooks/1367132750217220298/1tp4Hd8xF5mCa_QQ8rYMnIi63_vRPnsf0HU2xKcUr-mw7r4ngq3tIXOuHQbTl8K_ktHK'; // **SECURITY RISK**
    const authorInfo = { name: `${name.value} (${email.value})` };

    const payload: any = {
      content: `New ${reportType.value} **${title.value}** by **${name.value}** (${email.value}) submitted on **${submissionDate}** at **${submissionTime}**.`,
      embeds: [
        {
          title: title.value,
          description: reportMarkdown.value.substring(0, 2000), // Ensure max length
          author: authorInfo,
          timestamp: timestampISO,
          color: reportType.value === 'Bug report' ? 15548997 : (reportType.value === 'Feature Request' ? 3447003 : 5793266) // Red, Blue, Grey
        },
        // Add separate embeds for each image
        ...imageUrls.map(url => ({
          author: authorInfo, // Repeat author for context if images get separated
          image: { url: url }
        }))
      ],
      username: 'JavaWiz Communication Bot',
      avatar_url: 'https://www.treehugger.com/thmb/qSjoiKNpEOUzFE4xM8AaKFeSZSk=/750x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/__opt__aboutcom__coeus__resources__content_migration__mnn__images__2017__05__lady-bug-on-leaf-e3cd36cdc3024129b61926ddf6ef386e.jpg'
    };

    // Discord has a limit of 10 embeds per message
    if (payload.embeds.length > 10) {
      console.warn('More than 9 images attempted, truncating embeds to 10 total.');
      payload.embeds = payload.embeds.slice(0, 10);
    }


    // 4. Send to Discord
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Attempt to read Discord's error message if possible
      let discordError = `HTTP error ${response.status}`;
      try {
        const errorBody = await response.json();
        discordError += `: ${JSON.stringify(errorBody.message || errorBody)}`;
      } catch (_e) { /* Ignore parsing error */ }
      throw new Error(`Failed to send report to Discord. ${discordError}`);
    }

    // 5. Handle Success
    submitSuccess.value = true;

  } catch (error: any) {
    console.error('Submission failed:', error);
    submitError.value = `An error occurred: ${error.message || 'Unknown error'}. Please try again later.`;
    // If image upload failed, the specific error might be logged by uploadImage
  } finally {
    isSubmitting.value = false;
  }
}

// Watcher to clear general form error when user starts fixing the form
watch([reportType, title, name, email, reportMarkdown, selectedFiles], () => {
  if (attemptedSubmit.value && submitError.value?.includes('correct the errors')) {
    submitError.value = null; // Clear the generic "fix errors" message
  }
  // Also clear file error if user modifies markdown/other fields after a file error occurred
  // (they might have fixed the file issue separately) - though handleFileChange is better
});


</script>

<style scoped>
.report-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 10px 0; /* Add some vertical padding inside the form */
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

label {
  font-weight: bold;
  font-size: 0.9rem;
}

input[type="text"],
input[type="email"],
select,
textarea {
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
  width: 100%; /* Make inputs fill container */
  box-sizing: border-box; /* Include padding and border in width */
}

input:focus,
select:focus,
textarea:focus {
    border-color: #007bff;
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}


textarea {
  resize: vertical; /* Allow vertical resize only */
  min-height: 80px;
}

.required {
  color: red;
  margin-left: 2px;
}

.error-message {
  color: #dc3545; /* Bootstrap danger color */
  font-size: 0.8rem;
}

.general-error {
    text-align: center;
    font-weight: bold;
    margin-top: 5px;
}

.markdown-group {
  gap: 8px;
}

.markdown-editor {
  display: grid;
  grid-template-columns: 1fr 1fr; /* 50% 50% */
  gap: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 5px;
  min-height: 150px; /* Ensure some height even when empty */
}

.markdown-editor textarea {
    border: none; /* Remove border from internal textarea */
    outline: none;
    box-shadow: none;
    height: 100%; /* Fill the grid cell */
    min-height: 140px; /* Match parent slightly */
}

.markdown-preview {
  border-left: 1px solid #eee;
  padding-left: 10px;
  background-color: #f8f9fa;
  font-size: 0.9rem;
  overflow-y: auto; /* Allow scrolling if content overflows */
  max-height: 300px; /* Prevent excessive height */
  min-height: 140px;
  word-wrap: break-word; /* Prevent long words breaking layout */
}

/* Style basic markdown elements in preview */
.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3) {
    margin-top: 0.5em;
    margin-bottom: 0.25em;
}
.markdown-preview :deep(p) {
    margin-bottom: 0.5em;
}
.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
    padding-left: 20px;
}
.markdown-preview :deep(code) {
    background-color: #e9ecef;
    padding: 0.1em 0.3em;
    border-radius: 3px;
    font-size: 0.85em;
}
.markdown-preview :deep(pre) {
    background-color: #e9ecef;
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
}
.markdown-preview :deep(pre) code {
    background-color: transparent;
    padding: 0;
}
.markdown-preview :deep(blockquote) {
    border-left: 3px solid #ccc;
    padding-left: 10px;
    margin-left: 0;
    color: #6c757d;
}


input[type="file"] {
  border: none;
  padding: 0;
}

.file-list {
  list-style: none;
  padding: 0;
  margin-top: 5px;
  font-size: 0.8rem;
  color: #555;
}
.file-list li {
    padding: 2px 0;
}

.submission-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 10px;
  gap: 8px;
}

button[type="submit"], .success-message button {
  padding: 10px 20px;
  background-color: #28a745; /* Bootstrap success color */
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s ease;
}

button[type="submit"]:hover:not(:disabled) {
  background-color: #218838;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.success-message {
  text-align: center;
  padding: 20px;
}
.success-message h3 {
    color: #28a745;
    margin-bottom: 10px;
}
.success-message button {
    margin-top: 15px;
    background-color: #007bff; /* Blue for close */
}
.success-message button:hover {
    background-color: #0056b3;
}

/* Adjustments for smaller screens if needed */
@media (max-width: 768px) {
    .markdown-editor {
        grid-template-columns: 1fr; /* Stack editor and preview */
    }
    .markdown-preview {
        border-left: none;
        border-top: 1px solid #eee;
        padding-left: 0;
        padding-top: 10px;
        margin-top: 10px;
    }
}

</style>