// app.js
document.addEventListener("DOMContentLoaded", () => {
  const newClaimBtn = document.getElementById("newClaimBtn");
  const claimForm   = document.getElementById("claimForm");
  const submitBtn   = document.getElementById("submitClaimBtn");

  if (newClaimBtn) {
    newClaimBtn.addEventListener("click", () => {
      document.getElementById("wizard")?.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Formular-Submit (Enter) oder Button-Klick
  if (claimForm) {
    claimForm.addEventListener("submit", (e) => { e.preventDefault(); submitClaim(); });
  }
  if (submitBtn) submitBtn.addEventListener("click", submitClaim);
});

async function submitClaim() {
  // hole Werte aus deinen Inputs (IDs bitte anpassen, falls abweichend)
  const payload = {
    date_of_loss: document.getElementById("date_of_loss")?.value,
    claim_type: document.getElementById("claim_type")?.value,
    description: document.getElementById("description")?.value,
    location: document.getElementById("location")?.value,
    vehicle_id: null,
    third_party_involved: !!document.getElementById("third_party_involved")?.checked
  };

  try {
    const res = await fetch("/api/claims/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Fehler beim Absenden");

    // Erfolgsmeldung
    const msg = document.getElementById("submitMessage");
    if (msg) {
      msg.textContent = `Schaden erfasst. Vorgangsnummer: ${data.claim_number}`;
      msg.classList.remove("hidden");
    } else {
      alert(`Schaden erfasst. Vorgangsnummer: ${data.claim_number}`);
    }

    // Formular zurücksetzen / Wizard schließen
    document.getElementById("claimForm")?.reset();
    document.getElementById("wizard")?.classList.add("hidden");
  } catch (err) {
    console.error(err);
    alert("Fehler: " + err.message);
  }
}
