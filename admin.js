
document.getElementById("sendBtn")?.addEventListener("click", () => {
  const target = document.getElementById("target").value;
  const bug = document.getElementById("bug-type").value;
  fetch("/api/crash", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target })
  })
  .then(res => res.json())
  .then(data => alert(data.message))
  .catch(err => alert("Crash failed!"));
});
