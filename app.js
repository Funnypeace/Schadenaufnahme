// Kfz-Schadenaufnahme App - Main JavaScript File
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configuration
const SUPABASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'https://your-project-id.supabase.co' 
    : (import.meta.env?.VITE_SUPABASE_URL || 'https://your-project-id.supabase.co');

const SUPABASE_ANON_KEY = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'your-anon-key-here'
    : (import.meta.env?.VITE_SUPABASE_ANON_KEY || 'your-anon-key-here');

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Application State
let currentUser = null;
let currentStep = 1;
let currentClaimId = null;
let uploadedFiles = [];
let claimParties = [];

// DOM Elements
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

// Utility Functions
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function showMessage(element, message, type = 'info') {
    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = 'block';
    
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Authentication Functions
async function handleLogin(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const email = formData.get('email');
    
    showLoading();
    
    try {
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: window.location.href
            }
        });
        
        if (error) throw error;
        
        showMessage(authMessage, 'Magic-Link wurde gesendet. Bitte prüfen Sie Ihre E-Mails.', 'success');
        event.target.reset();
    } catch (error) {
        console.error('Login error:', error);
        showMessage(authMessage, 'Fehler beim Senden des Magic-Links: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function handleLogout() {
    showLoading();
    
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        showAuthSection();
        showToast('Erfolgreich abgemeldet', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Fehler beim Abmelden: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// UI Navigation Functions
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

// Wizard Functions
function resetWizard() {
    currentStep = 1;
    currentClaimId = null;
    uploadedFiles = [];
    claimParties = [];
    
    // Reset form
    claimWizardForm.reset();
    
    // Set default date to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('dateOfLoss').value = now.toISOString().slice(0, 16);
    
    // Reset wizard steps
    updateWizardStep();
    updateProgressIndicator();
    
    // Clear uploaded files
    uploadedFilesContainer.innerHTML = '';
    
    // Clear parties
    partiesContainer.innerHTML = '';
}

function updateWizardStep() {
    // Hide all steps
    document.querySelectorAll('.wizard-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Show current step
    const currentStepElement = document.querySelector(`[data-step="${currentStep}"]`);
    if (currentStepElement) {
        currentStepElement.classList.add('active');
    }
    
    // Update navigation buttons
    prevStepBtn.style.display = currentStep > 1 ? 'inline-flex' : 'none';
    nextStepBtn.style.display = currentStep < 5 ? 'inline-flex' : 'none';
    submitClaimBtn.style.display = currentStep === 5 ? 'inline-flex' : 'none';
}

function updateProgressIndicator() {
    document.querySelectorAll('.progress-step').forEach((step, index) => {
        const stepNumber = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNumber < currentStep) {
            step.classList.add('completed');
        } else if (stepNumber === currentStep) {
            step.classList.add('active');
        }
    });
}

function nextStep() {
    if (validateCurrentStep()) {
        if (currentStep < 5) {
            currentStep++;
            updateWizardStep();
            updateProgressIndicator();
            
            if (currentStep === 5) {
                generateSummary();
            }
        }
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
    
    // Additional validation for specific steps
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

// Claims Functions
async function loadClaims() {
    showLoading();
    
    try {
        const { data: claims, error } = await supabase
            .from('claims')
            .select(`
                *,
                vehicles (license_plate, make, model)
            `)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        renderClaims(claims || []);
    } catch (error) {
        console.error('Error loading claims:', error);
        showToast('Fehler beim Laden der Schadenfälle: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderClaims(claims) {
    if (claims.length === 0) {
        claimsList.innerHTML = `
            <div class="claim-card">
                <p style="text-align: center; color: var(--text-secondary);">
                    Noch keine Schadenfälle vorhanden. Klicken Sie auf "Neuen Schaden melden", um zu beginnen.
                </p>
            </div>
        `;
        return;
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
                <div class="claim-status status-${claim.status}">
                    ${getStatusLabel(claim.status)}
                </div>
            </div>
            <div class="claim-details">
                ${claim.description ? claim.description.substring(0, 100) + (claim.description.length > 100 ? '...' : '') : 'Keine Beschreibung'}
            </div>
        </div>
    `).join('');
}

function getStatusLabel(status) {
    const labels = {
        'draft': 'Entwurf',
        'submitted': 'Eingereicht',
        'in_review': 'In Bearbeitung',
        'closed': 'Abgeschlossen'
    };
    return labels[status] || status;
}

async function saveDraft() {
    showLoading();
    
    try {
        const claimData = collectFormData();
        claimData.status = 'draft';
        
        let result;
        if (currentClaimId) {
            // Update existing claim
            result = await supabase
                .from('claims')
                .update(claimData)
                .eq('id', currentClaimId)
                .select()
                .single();
        } else {
            // Create new claim
            claimData.owner_id = currentUser.id;
            result = await supabase
                .from('claims')
                .insert(claimData)
                .select()
                .single();
            
            if (result.data) {
                currentClaimId = result.data.id;
            }
        }
        
        if (result.error) throw result.error;
        
        // Save vehicle data if provided
        await saveVehicleData();
        
        // Save parties
        await saveParties();
        
        showToast('Entwurf erfolgreich gespeichert', 'success');
    } catch (error) {
        console.error('Error saving draft:', error);
        showToast('Fehler beim Speichern des Entwurfs: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function submitClaim() {
    if (!validateCurrentStep()) return;
    
    const confirmAccuracy = document.getElementById('confirmAccuracy').checked;
    if (!confirmAccuracy) {
        showToast('Bitte bestätigen Sie die Richtigkeit Ihrer Angaben.', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const claimData = collectFormData();
        claimData.status = 'submitted';
        
        let result;
        if (currentClaimId) {
            // Update existing claim
            result = await supabase
                .from('claims')
                .update(claimData)
                .eq('id', currentClaimId)
                .select()
                .single();
        } else {
            // Create new claim
            claimData.owner_id = currentUser.id;
            result = await supabase
                .from('claims')
                .insert(claimData)
                .select()
                .single();
            
            if (result.data) {
                currentClaimId = result.data.id;
            }
        }
        
        if (result.error) throw result.error;
        
        // Save vehicle data
        await saveVehicleData();
        
        // Save parties
        await saveParties();
        
        // Add status history entry
        await supabase
            .from('claim_status_history')
            .insert({
                claim_id: currentClaimId,
                status: 'submitted',
                changed_by: currentUser.id,
                note: 'Schadenfall eingereicht'
            });
        
        showToast('Schadenfall erfolgreich eingereicht!', 'success');
        
        // Return to dashboard after a short delay
        setTimeout(() => {
            showDashboard();
        }, 2000);
        
    } catch (error) {
        console.error('Error submitting claim:', error);
        showToast('Fehler beim Einreichen des Schadenfalls: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
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
    
    // Check if vehicle already exists
    const { data: existingVehicle } = await supabase
        .from('vehicles')
        .select('id')
        .eq('license_plate', vehicleData.license_plate)
        .eq('owner_profile_id', currentUser.id)
        .single();
    
    let vehicleId;
    if (existingVehicle) {
        // Update existing vehicle
        const { data, error } = await supabase
            .from('vehicles')
            .update(vehicleData)
            .eq('id', existingVehicle.id)
            .select('id')
            .single();
        
        if (error) throw error;
        vehicleId = data.id;
    } else {
        // Create new vehicle
        const { data, error } = await supabase
            .from('vehicles')
            .insert(vehicleData)
            .select('id')
            .single();
        
        if (error) throw error;
        vehicleId = data.id;
    }
    
    // Update claim with vehicle_id
    if (currentClaimId && vehicleId) {
        await supabase
            .from('claims')
            .update({ vehicle_id: vehicleId })
            .eq('id', currentClaimId);
    }
    
    // Save drivability as damage entry
    const drivable = formData.get('drivable');
    if (drivable !== '' && currentClaimId) {
        await supabase
            .from('damages')
            .insert({
                claim_id: currentClaimId,
                area: 'Allgemein',
                description: 'Fahrzeug ist ' + (drivable === 'true' ? 'fahrbereit' : 'nicht fahrbereit'),
                drivable: drivable === 'true'
            });
    }
}

async function saveParties() {
    if (!currentClaimId || claimParties.length === 0) return;
    
    // Delete existing parties for this claim
    await supabase
        .from('claim_parties')
        .delete()
        .eq('claim_id', currentClaimId);
    
    // Insert new parties
    const partiesToInsert = claimParties.map(party => ({
        ...party,
        claim_id: currentClaimId
    }));
    
    const { error } = await supabase
        .from('claim_parties')
        .insert(partiesToInsert);
    
    if (error) throw error;
}

// File Upload Functions
function setupFileUpload() {
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
}

function handleDragOver(event) {
    event.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = Array.from(event.dataTransfer.files);
    handleFiles(files);
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    handleFiles(files);
}

async function handleFiles(files) {
    for (const file of files) {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            showToast(`Datei "${file.name}" ist zu groß (max. 10MB)`, 'error');
            continue;
        }
        
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
            showToast(`Dateityp "${file.type}" wird nicht unterstützt`, 'error');
            continue;
        }
        
        await uploadFile(file);
    }
}

async function uploadFile(file) {
    if (!currentClaimId) {
        // Save draft first to get claim ID
        await saveDraft();
        if (!currentClaimId) {
            showToast('Fehler: Konnte Schaden nicht speichern', 'error');
            return;
        }
    }
    
    showLoading();
    
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `claims/${currentClaimId}/${fileName}`;
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('claim-files')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (uploadError) throw uploadError;
        
        // Save document record
        const { data: docData, error: docError } = await supabase
            .from('documents')
            .insert({
                claim_id: currentClaimId,
                uploaded_by: currentUser.id,
                file_path: uploadData.path,
                file_type: file.type
            })
            .select()
            .single();
        
        if (docError) throw docError;
        
        // Add to uploaded files list
        uploadedFiles.push({
            id: docData.id,
            name: file.name,
            size: file.size,
            type: file.type,
            path: uploadData.path,
            url: supabase.storage.from('claim-files').getPublicUrl(uploadData.path).data.publicUrl
        });
        
        renderUploadedFiles();
        showToast(`Datei "${file.name}" erfolgreich hochgeladen`, 'success');
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast(`Fehler beim Hochladen von "${file.name}": ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

function renderUploadedFiles() {
    uploadedFilesContainer.innerHTML = uploadedFiles.map(file => `
        <div class="file-item" data-file-id="${file.id}">
            ${file.type.startsWith('image/') ? 
                `<img src="${file.url}" alt="${file.name}" class="file-preview">` :
                `<div class="file-preview" style="display: flex; align-items: center; justify-content: center; background: var(--border-color); color: var(--text-muted);">PDF</div>`
            }
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <div class="file-actions">
                <button type="button" class="btn-icon" onclick="removeFile('${file.id}')" title="Datei entfernen">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

async function removeFile(fileId) {
    showLoading();
    
    try {
        const file = uploadedFiles.find(f => f.id === fileId);
        if (!file) return;
        
        // Delete from storage
        const { error: storageError } = await supabase.storage
            .from('claim-files')
            .remove([file.path]);
        
        if (storageError) throw storageError;
        
        // Delete document record
        const { error: docError } = await supabase
            .from('documents')
            .delete()
            .eq('id', fileId);
        
        if (docError) throw docError;
        
        // Remove from local array
        uploadedFiles = uploadedFiles.filter(f => f.id !== fileId);
        renderUploadedFiles();
        
        showToast('Datei erfolgreich entfernt', 'success');
        
    } catch (error) {
        console.error('Error removing file:', error);
        showToast('Fehler beim Entfernen der Datei: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Make removeFile globally available
window.removeFile = removeFile;

// Party Management Functions
function setupPartyManagement() {
    addPartyBtn.addEventListener('click', addParty);
}

function addParty() {
    const partyId = crypto.randomUUID();
    const party = {
        id: partyId,
        role: 'third_party',
        name: '',
        phone: '',
        email: '',
        address: '',
        insurance_company: ''
    };
    
    claimParties.push(party);
    renderParties();
}

function renderParties() {
    partiesContainer.innerHTML = claimParties.map((party, index) => `
        <div class="party-item" data-party-id="${party.id}">
            <div class="party-header">
                <h4 class="party-title">Person ${index + 1}</h4>
                <button type="button" class="btn-icon" onclick="removeParty('${party.id}')" title="Person entfernen">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Rolle</label>
                    <select onchange="updateParty('${party.id}', 'role', this.value)">
                        <option value="third_party" ${party.role === 'third_party' ? 'selected' : ''}>Unfallgegner</option>
                        <option value="witness" ${party.role === 'witness' ? 'selected' : ''}>Zeuge</option>
                        <option value="police" ${party.role === 'police' ? 'selected' : ''}>Polizei</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" value="${party.name}" onchange="updateParty('${party.id}', 'name', this.value)" placeholder="Vor- und Nachname">
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Telefon</label>
                    <input type="tel" value="${party.phone}" onchange="updateParty('${party.id}', 'phone', this.value)" placeholder="+49 123 456789">
                </div>
                <div class="form-group">
                    <label>E-Mail</label>
                    <input type="email" value="${party.email}" onchange="updateParty('${party.id}', 'email', this.value)" placeholder="email@beispiel.de">
                </div>
            </div>
            
            <div class="form-group">
                <label>Adresse</label>
                <input type="text" value="${party.address}" onchange="updateParty('${party.id}', 'address', this.value)" placeholder="Straße, PLZ Ort">
            </div>
            
            ${party.role === 'third_party' ? `
                <div class="form-group">
                    <label>Versicherung</label>
                    <input type="text" value="${party.insurance_company}" onchange="updateParty('${party.id}', 'insurance_company', this.value)" placeholder="Name der Versicherung">
                </div>
            ` : ''}
        </div>
    `).join('');
}

function updateParty(partyId, field, value) {
    const party = claimParties.find(p => p.id === partyId);
    if (party) {
        party[field] = value;
        
        // Re-render if role changed (to show/hide insurance field)
        if (field === 'role') {
            renderParties();
        }
    }
}

function removeParty(partyId) {
    claimParties = claimParties.filter(p => p.id !== partyId);
    renderParties();
}

// Make party functions globally available
window.updateParty = updateParty;
window.removeParty = removeParty;

// Summary Generation
function generateSummary() {
    const formData = new FormData(claimWizardForm);
    const summaryContainer = document.getElementById('claimSummary');
    
    const dateOfLoss = new Date(formData.get('date_of_loss'));
    const claimType = formData.get('claim_type');
    const description = formData.get('description');
    const location = formData.get('location');
    const thirdPartyInvolved = formData.get('third_party_involved') === 'on';
    
    const licensePlate = formData.get('license_plate');
    const make = formData.get('make');
    const model = formData.get('model');
    const modelYear = formData.get('model_year');
    const mileage = formData.get('mileage');
    const drivable = formData.get('drivable');
    
    summaryContainer.innerHTML = `
        <div class="summary-section">
            <h4 class="summary-title">Schadendetails</h4>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">Datum/Uhrzeit</div>
                    <div class="summary-value">${formatDate(dateOfLoss.toISOString())}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Schadenart</div>
                    <div class="summary-value">${claimType}</div>
                </div>
                ${location ? `
                    <div class="summary-item">
                        <div class="summary-label">Ort</div>
                        <div class="summary-value">${location}</div>
                    </div>
                ` : ''}
                <div class="summary-item">
                    <div class="summary-label">Weitere Beteiligte</div>
                    <div class="summary-value">${thirdPartyInvolved ? 'Ja' : 'Nein'}</div>
                </div>
            </div>
            <div class="summary-content">
                <strong>Schadenhergang:</strong><br>
                ${description}
            </div>
        </div>
        
        ${licensePlate ? `
            <div class="summary-section">
                <h4 class="summary-title">Fahrzeugdaten</h4>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">Kennzeichen</div>
                        <div class="summary-value">${licensePlate}</div>
                    </div>
                    ${make ? `
                        <div class="summary-item">
                            <div class="summary-label">Hersteller</div>
                            <div class="summary-value">${make}</div>
                        </div>
                    ` : ''}
                    ${model ? `
                        <div class="summary-item">
                            <div class="summary-label">Modell</div>
                            <div class="summary-value">${model}</div>
                        </div>
                    ` : ''}
                    ${modelYear ? `
                        <div class="summary-item">
                            <div class="summary-label">Baujahr</div>
                            <div class="summary-value">${modelYear}</div>
                        </div>
                    ` : ''}
                    ${mileage ? `
                        <div class="summary-item">
                            <div class="summary-label">Kilometerstand</div>
                            <div class="summary-value">${parseInt(mileage).toLocaleString('de-DE')} km</div>
                        </div>
                    ` : ''}
                    ${drivable !== '' ? `
                        <div class="summary-item">
                            <div class="summary-label">Fahrbereit</div>
                            <div class="summary-value">${drivable === 'true' ? 'Ja' : 'Nein'}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        ` : ''}
        
        ${claimParties.length > 0 ? `
            <div class="summary-section">
                <h4 class="summary-title">Beteiligte Personen</h4>
                <div class="summary-content">
                    ${claimParties.map((party, index) => `
                        <div style="margin-bottom: 1rem;">
                            <strong>Person ${index + 1} (${getRoleLabel(party.role)}):</strong><br>
                            ${party.name || 'Kein Name angegeben'}<br>
                            ${party.phone ? `Tel: ${party.phone}<br>` : ''}
                            ${party.email ? `E-Mail: ${party.email}<br>` : ''}
                            ${party.address ? `Adresse: ${party.address}<br>` : ''}
                            ${party.insurance_company ? `Versicherung: ${party.insurance_company}` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        ${uploadedFiles.length > 0 ? `
            <div class="summary-section">
                <h4 class="summary-title">Hochgeladene Dateien</h4>
                <div class="summary-content">
                    ${uploadedFiles.map(file => `
                        <div style="margin-bottom: 0.5rem;">
                            • ${file.name} (${formatFileSize(file.size)})
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;
}

function getRoleLabel(role) {
    const labels = {
        'third_party': 'Unfallgegner',
        'witness': 'Zeuge',
        'police': 'Polizei'
    };
    return labels[role] || role;
}

// Event Listeners
function setupEventListeners() {
    // Authentication
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    
    // Navigation
    newClaimBtn.addEventListener('click', showClaimForm);
    backToDashboard.addEventListener('click', showDashboard);
    
    // Wizard navigation
    nextStepBtn.addEventListener('click', nextStep);
    prevStepBtn.addEventListener('click', prevStep);
    saveDraftBtn.addEventListener('click', saveDraft);
    claimWizardForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitClaim();
    });
    
    // License plate formatting
    document.getElementById('licensePlate').addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });
    
    // Setup file upload and party management
    setupFileUpload();
    setupPartyManagement();
}

// Initialize Application
async function initializeApp() {
    setupEventListeners();
    
    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        userEmail.textContent = currentUser.email;
        showDashboard();
    } else {
        showAuthSection();
    }
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            userEmail.textContent = currentUser.email;
            
            // Create or update profile
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: currentUser.id,
                    email: currentUser.email,
                    full_name: currentUser.user_metadata?.full_name || null
                });
            
            if (error) {
                console.error('Error creating/updating profile:', error);
            }
            
            showDashboard();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showAuthSection();
        }
    });
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);
