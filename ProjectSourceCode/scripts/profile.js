document.addEventListener("DOMContentLoaded", () => {
  /* =======================
     EMAIL NOTIFICATION TOGGLE
     ======================= */
  const emailToggle = document.getElementById("emailToggle");

  const savedNotif = localStorage.getItem("emailNotifications");
  if (savedNotif === "on") {
    emailToggle.checked = true;
  }

  emailToggle.addEventListener("change", () => {
    localStorage.setItem(
      "emailNotifications",
      emailToggle.checked ? "on" : "off"
    );
  });

  /* =======================
     PROFILE PICTURE HANDLING
     ======================= */
  const profileImage = document.getElementById("profileImage");
  const avatarUpload = document.getElementById("avatarUpload");

  // Load saved image if available
  const savedImage = localStorage.getItem("profileImage");
  if (savedImage) {
    profileImage.src = savedImage;
  } else {
    profileImage.src = "../static/img/default-avatar.png";
  }

  // Handle uploading a new image
  avatarUpload.addEventListener("change", () => {
    const file = avatarUpload.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;

      // Update preview
      profileImage.src = base64;

      // Save to localStorage
      localStorage.setItem("profileImage", base64);
    };

    reader.readAsDataURL(file);
  });


  /* ====================================================
     POLITICIANS FOLLOWED — NEW SECTION YOU REQUESTED
     ==================================================== */
  const politiciansListEl = document.getElementById("politiciansList");
  const politiciansEmptyEl = document.getElementById("politiciansEmpty");

  function renderFollowedPoliticians() {
    let followed = [];

    try {
      followed = JSON.parse(localStorage.getItem("followedPoliticians") || "[]");
    } catch {
      followed = [];
    }

    // Clear old list
    politiciansListEl.innerHTML = "";

    if (!followed || followed.length === 0) {
      politiciansEmptyEl.hidden = false;
      politiciansListEl.hidden = true;
      return;
    }

    politiciansEmptyEl.hidden = true;
    politiciansListEl.hidden = false;

    followed.forEach((p) => {
      const li = document.createElement("li");
      li.className = "politician-item";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";

      const name = document.createElement("p");
      name.className = "politician-name";
      name.textContent = p.name || "Unnamed";

      const meta = document.createElement("span");
      meta.className = "politician-meta";
      if (p.title) meta.textContent = p.title;

      left.appendChild(name);
      if (p.title) left.appendChild(meta);

      const unfollowBtn = document.createElement("button");
      unfollowBtn.textContent = "Unfollow";
      unfollowBtn.style.padding = "6px 10px";
      unfollowBtn.style.fontSize = "0.85rem";
      unfollowBtn.style.borderRadius = "6px";
      unfollowBtn.style.cursor = "pointer";
      unfollowBtn.style.border = "none";
      unfollowBtn.style.background = "rgba(255,255,255,0.08)";
      unfollowBtn.style.color = "white";

      unfollowBtn.addEventListener("click", () => {
        const updated = followed.filter(
          (x) => (x.id || x.name) !== (p.id || p.name)
        );
        localStorage.setItem("followedPoliticians", JSON.stringify(updated));

        renderFollowedPoliticians();
      });

      li.appendChild(left);
      li.appendChild(unfollowBtn);
      politiciansListEl.appendChild(li);
    });
  }

  // Render list when page loads
  renderFollowedPoliticians();
});
