self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.text() : "Timetable Alert!";
  event.waitUntil(
    self.registration.showNotification("Class Reminder", {
      body: data,
      icon: "icon-192.png"
    })
  );
});
