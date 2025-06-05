document.addEventListener("DOMContentLoaded", async () => {
  const eventList = document.querySelector(".event-list");

  try {
    const response = await fetch('https://bookmyshow-backend-447882412945.asia-south1.run.app/api/events');
    if (!response.ok) throw new Error('Failed to fetch events');

    const events = await response.json();

    events.forEach(event => {
      const eventCard = document.createElement("div");
      eventCard.classList.add("event-card");
      eventCard.innerHTML = `
        <h3>${event.title}</h3>
        <p>Date: ${event.date}</p>
        <p>Location: ${event.location}</p>
        <button onclick="bookTicket('${event.title}')">Book Now</button>
      `;
      eventList.appendChild(eventCard);
    });

  } catch (error) {
    eventList.innerHTML = `<p style="color: red;">Error loading events: ${error.message}</p>`;
  }
});

function bookTicket(eventTitle) {
  alert(`You have booked a ticket for ${eventTitle}!`);
}
