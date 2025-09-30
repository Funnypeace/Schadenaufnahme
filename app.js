// Kfz-Schadenaufnahme App - Main JavaScript File
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 1) Load Supabase config from API, then initialize app
async function loadEnvAndInit() {
  try {
    const res = await fetch('/api/env');
    if (!res.ok) throw new Error('Konfiguration konnte nicht geladen werden');
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await res.json();
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Ungültige Supabase-Konfiguration');

    // Initialize Supabase AFTER we have keys
    window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Now start the app
    initializeApp();
  } catch (err) {
    console.error('Env load/init error:', err);
    const toastContainer = document.getElementById('toastContainer');
    if (toastContainer) {
      const d = document.createElement('div');
      d.className = 'toast error';
      d.textContent = 'Fehler beim Laden der Konfiguration: ' + err.message;
      toastContainer.appendChild(d);
    } else {
      alert('Fehler beim Laden der Konfiguration: ' + err.message);
    }
  }
}

// 2) App state
let currentUser = null;
let currentStep = 1;
let currentClaimId = null;
let uploadedFiles = [];
let claimParties = [];

// 3) DOM elements
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const claimFormSection = document.getElementById('claimFormSection');
const loginForm = document.getElementById('loginForm');
const authMessage = document.getElementById('authMessage');
const userInfo = document.getElementById('userInfo');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const newClaimBtn = document.getElementById('newClaimBtn');
const backToDashboard = document.getElementById('backToDashboard');
const claimsList = document.getElementById('claimsList');
const claimWizardForm = document.getElementById('claimWizardForm');
const loadingOverlay = document.getElementById('loadingOverlay');
const toastContainer = document.getElementById('toastContainer');

// Wizard Navigation
const prevStepBtn = document.getElementById('prevStepBtn');
const nextStepBtn = document.getElementById('nextStepBtn');
const saveDraftBtn = document.getElementById('saveDraftBtn');
const submitClaimBtn = document.getElementById('submitClaimBtn');

// File Upload
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadedFilesContainer = document.getElementById('uploadedFiles');

// Parties
const partiesContainer = document.getElementById('partiesContainer');
const addPartyBtn = document.getElementById('addPartyBtn');

// 4) Utils
function showLoading() { loadingOverlay.style.display = 'flex'; }
function hideLoading() { loadingOverlay.style.display = 'none'; }
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}
function showMessage(element, message, type = 'info') {
  element.textContent = message;
  element.className = `message ${type}`;
  element.style.display = 'block';
  setTimeout(() => { element.style.display = 'none'; }, 5000);
}
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 5) Auth
async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const email = formData.get('email');
  showLoading();
  try {
    const { error } = await window.supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href }
    });
    if (error) throw error;
    showMessage(authMessage, 'Magic-Link wurde gesendet. Bitte prüfen Sie Ihre E-Mails.', 'success');
    event.target.reset();
  } catch (error) {
    console.error('Login error:', error);
    showMessage(authMessage, 'Fehler beim Senden des Magic-Links: ' + error.message, 'error');
  } finally { hideLoading(); }
}
async function handleLogout() {
  showLoading();
  try {
    const { error } = await window.supabase.auth.signOut();
    if (error) throw error;
    currentUser = null;
    showAuthSection();
    showToast('Erfolgreich abgemeldet', 'success');
  } catch (error) {
    console.error('Logout error:', error);
    showToast('Fehler beim Abmelden: ' + error.message, 'error');
  } finally { hideLoading(); }
}

// 6) UI navigation
function showAuthSection() {
  authSection.style.display = 'block';
  dashboardSection.style.display = 'none';
  claimFormSection.style.display = 'none';
  userInfo.style.display = 'none';
}
function showDashboard() {
  authSection.style.display = 'none';
  dashboardSection.style.display = 'block';
  claimFormSection.style.display = 'none';
  userInfo.style.display = 'flex';
  loadClaims();
}
function showClaimForm() {
  authSection.style.display = 'none';
  dashboardSection.style.display = 'none';
  claimFormSection.style.display = 'block';
  userInfo.style.display = 'flex';
  resetWizard();
}

// 7) Wizard
function resetWizard() {
  currentStep = 1;
  currentClaimId = null;
  uploadedFiles = [];
  claimParties = [];
  claimWizardForm.reset();
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('dateOfLoss').value = now.toISOString().slice(0, 16);
  updateWizardStep();
  updateProgressIndicator();
  uploadedFilesContainer.innerHTML = '';
  partiesContainer.innerHTML = '';
}
function updateWizardStep() {
  document.querySelectorAll('.wizard-step').forEach(step => step.classList.remove('active'));
  const currentStepElement = document.querySelector(`[data-step="${currentStep}"]`);
  if (currentStepElement) currentStepElement.classList.add('active');
  prevStepBtn.style.display = currentStep > 1 ? 'inline-flex' : 'none';
  nextStepBtn.style.display = currentStep < 5 ? 'inline-flex' : 'none';
  submitClaimBtn.style.display = currentStep === 5 ? 'inline-flex' : 'none';
}
function updateProgressIndicator() {
  document.querySelectorAll('.progress-step').forEach((step, index) => {
    const stepNumber = index + 1;
    step.classList.remove('active', 'completed');
    if (stepNumber < currentStep) step.classList.add('completed');
    else if (stepNumber === currentStep) step.classList.add('active');
  });
}
function nextStep() {
  if (validateCurrentStep() && currentStep < 5) {
    currentStep++;
    updateWizardStep();
    updateProgressIndicator();
    if (currentStep === 5) generateSummary();
  }
}
function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    updateWizardStep();
    updateProgressIndicator();
  }
}
function validateCurrentStep() {
  const currentStepElement = document.querySelector(`[data-step="${currentStep}"]`);
  const requiredFields = currentStepElement.querySelectorAll('[required]');
  let isValid = true;
  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      field.focus();
      showToast(`Bitte füllen Sie das Feld "${field.labels[0]?.textContent || field.name}" aus.`, 'error');
      isValid = false;
      return false;
    }
  });
  if (currentStep === 2) {
    const licensePlate = document.getElementById('licensePlate').value;
    const pattern = /^[A-ZÄÖÜ]{1,3}-[A-Z]{1,2}\s?\d{1,4}$/;
    if (licensePlate && !pattern.test(licensePlate)) {
      showToast('Bitte geben Sie ein gültiges Kennzeichen ein (z.B. HH-AB 1234).', 'error');
      isValid = false;
    }
  }
  return isValid;
}

// 8) Claims
async function loadClaims() {
  showLoading();
  try {
    const { data: claims, error } = await window.supabase
      .from('claims')
      .select(`*, vehicles (license_plate, make, model)`) 
      .order('created_at', { ascending: false });
    if (error) throw error;
    renderClaims(claims || []);
  } catch (error) {
    console.error('Error loading claims:', error);
    showToast('Fehler beim Laden der Schadenfälle: ' + error.message, 'error');
  } finally { hideLoading(); }
}
function renderClaims(claims) {
  if (claims.length === 0) {
    claimsList.innerHTML = `
      <div class="claim-card">
        <p style="text-align: center; color: var(--text-secondary);">
          Noch keine Schadenfälle vorhanden. Klicken Sie auf "Neuen Schaden melden", um zu beginnen.
        </p>
      </div>`; return;
  }
  claimsList.innerHTML = claims.map(claim => `
    <div class="claim-card">
      <div class="claim-header">
        <div>
          <div class="claim-number">${claim.claim_number}</div>
          <div class="claim-details">
            ${formatDate(claim.date_of_loss)} • ${claim.claim_type}
            ${claim.vehicles ? ` • ${claim.vehicles.license_plate}` : ''}
          </div>
        </div>
        <div class="claim-status status-${claim.status}">${getStatusLabel(claim.status)}</div>
      </div>
      <div class="claim-details">
        ${claim.description ? claim.description.substring(0, 100) + (claim.description.length > 100 ? '...' : '') : 'Keine Beschreibung'}
      </div>
    </div>`).join('');
}
function getStatusLabel(status) {
  const labels = { draft: 'Entwurf', submitted: 'Eingereicht', in_review: 'In Bearbeitung', closed: 'Abgeschlossen' };
  return labels[status] || status;
}
async function saveDraft() {
  showLoading();
  try {
    const claimData = collectFormData();
    claimData.status = 'draft';
    let result;
    if (currentClaimId) {
      result = await window.supabase.from('claims').update(claimData).eq('id', currentClaimId).select().single();
    } else {
      claimData.owner_id = currentUser.id;
      result = await window.supabase.from('claims').insert(claimData).select().single();
      if (result.data) currentClaimId = result.data.id;
    }
    if (result.error) throw result.error;
    await saveVehicleData();
    await saveParties();
    showToast('Entwurf erfolgreich gespeichert', 'success');
  } catch (error) {
    console.error('Error saving draft:', error);
    showToast('Fehler beim Speichern des Entwurfs: ' + error.message, 'error');
  } finally { hideLoading(); }
}
async function submitClaim() {
  if (!validateCurrentStep()) return;
  const confirmAccuracy = document.getElementById('confirmAccuracy').checked;
  if (!confirmAccuracy) { showToast('Bitte bestätigen Sie die Richtigkeit Ihrer Angaben.', 'error'); return; }
  showLoading();
  try {
    const claimData = collectFormData();
    claimData.status = 'submitted';
    let result;
    if (currentClaimId) {
      result = await window.supabase.from('claims').update(claimData).eq('id', currentClaimId).select().single();
    } else {
      claimData.owner_id = currentUser.id;
      result = await window.supabase.from('claims').insert(claimData).select().single();
      if (result.data) currentClaimId = result.data.id;
    }
    if (result.error) throw result.error;
    await saveVehicleData();
    await saveParties();
    await window.supabase.from('claim_status_history').insert({
      claim_id: currentClaimId, status: 'submitted', changed_by: currentUser.id, note: 'Schadenfall eingereicht'
    });
    showToast('Schadenfall erfolgreich eingereicht!', 'success');
    setTimeout(() => { showDashboard(); }, 2000);
  } catch (error) {
    console.error('Error submitting claim:', error);
    showToast('Fehler beim Einreichen des Schadenfalls: ' + error.message, 'error');
  } finally { hideLoading(); }
}
function collectFormData() {
  const formData = new FormData(claimWizardForm);
  return {
    date_of_loss: new Date(formData.get('date_of_loss')).toISOString(),
    claim_type: formData.get('claim_type'),
    description: formData.get('description'),
    location: formData.get('location') ? { address: formData.get('location') } : null,
    third_party_involved: formData.get('third_party_involved') === 'on'
  };
}
async function saveVehicleData() {
  const formData = new FormData(claimWizardForm);
  const licensePlate = formData.get('license_plate');
  if (!licensePlate) return;
  const vehicleData = {
    owner_profile_id: currentUser.id,
    license_plate: licensePlate.toUpperCase(),
    vin: formData.get('vin') || null,
    make: formData.get('make') || null,
    model: formData.get('model') || null,
    model_year: formData.get('model_year') ? parseInt(formData.get('model_year')) : null,
    mileage: formData.get('mileage') ? parseInt(formData.get('mileage')) : null
  };
  const { data: existingVehicle } = await window.supabase
    .from('vehicles').select('id')
    .eq('license_plate', vehicleData.license_plate)
    .eq('owner_profile_id', currentUser.id)
    .single();
  let vehicleId;
  if (existingVehicle) {
    const { data, error } = await window.supabase.from('vehicles').update(vehicleData).eq('id', existingVehicle.id).select('id').single();
    if (error) throw error; vehicleId = data.id;
  } else {
    const { data, error } = await window.supabase.from('vehicles').insert(vehicleData).select('id').single();
    if (error) throw error; vehicleId = data.id;
  }
  if (currentClaimId && vehicleId) {
    await window.supabase.from('claims').update({ vehicle_id: vehicleId }).eq('id', currentClaimId);
  }
  const drivable = formData.get('drivable');
  if (drivable !== '' && currentClaimId) {
    await window.supabase.from('damages').insert({
      claim_id: currentClaimId,
      area: 'Allgemein',
      description: 'Fahr
