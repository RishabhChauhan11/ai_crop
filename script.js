function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const error = document.getElementById("error-message");

  if (username === "" || password === "") {
    error.textContent = "Please fill in all fields.";
    return;
  }

  // Demo authentication (replace with real backend later)
  if (username === "farmer" && password === "farmer123") {
    alert("Login successful! Welcome to AI Agriculture Advisory System.");
    window.location.href = "dashboard.html"; // Redirect after success
  } else {
    error.textContent = "Invalid username or password.";
  }
}


