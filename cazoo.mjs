#!/usr/bin/env node

import axios from "axios";
import { JSDOM } from "jsdom";
import { queue } from "async";

const query =
  "bodyType=SUV%2CEstate&chosenPriceType=total&gearbox=Automatic&maxPrice=20000&ownershipType=purchase&runningCosts=ulezChargeExempt&minPrice=5000&sort=price-asc&pageSize=48";

function search(page) {
  return `https://www.cazoo.co.uk/api/search?${query}&page=${page}`;
}
function carUrl(id) {
  return `https://www.cazoo.co.uk/car-details/${id}/`;
}
function carDesc(car) {
  return `${car.make} ${car.model} ${car.displayVariant} (${car.registrationYear})`;
}

const speeds = [];
let cars = [];
let response;
let i = 1;
let count = 0;

while ((response = await axios.get(search(i))).data.results.length > 0) {
  cars.push(...response.data.results);
  console.log(`Fetched page ${i}`);
  i++;
}

if (response.status !== 200) {
  console.log("Response was not 200", response);
}

const q = queue(async (car) => {
  const carResponse = await axios.get(carUrl(car.id));

  if (carResponse.status !== 200) {
    console.log(`Failed to fetch car from ${carUrl(car.id)}`);
  }

  const dom = new JSDOM(carResponse.data);
  const acceleration = Number(
    dom.window.document
      .querySelector('[data-test-id="Acceleration (0-62 mph)"] dd')
      .textContent.replace(" seconds", "")
  );

  speeds.push({
    makeModel: carDesc(car),
    acceleration,
    price: car.pricing.fullPrice.value,
    id: `https://www.cazoo.co.uk/car-details/${car.id}/`,
  });
  console.log(`Fetched ${count++}/${cars.length}`);
}, 10);

q.push(cars);

await q.drain();

console.table(
  speeds
    .filter((x) => x.acceleration)
    .sort((a, b) => a.acceleration - b.acceleration)
    .slice(0, 30)
);
