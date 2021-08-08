#!/usr/bin/env node

import { queue } from "async";
import axios from "axios";
import { JSDOM } from "jsdom";
import fs from "fs";

const query =
  "bodyType=SUV%2CEstate&chosenPriceType=total&gearbox=Automatic&maxPrice=15000&ownershipType=purchase&runningCosts=ulezChargeExempt&minPrice=5000&sort=price-asc&pageSize=48";

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
  process.stdout.write(`\rFetched page ${i}`);
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

  const bootSpace = Number(
    dom.window.document
      .querySelector('[data-test-id="Boot space (seats-up)"] dd')
      .textContent.replace(" litres", "")
  );

  speeds.push({
    makeModel: carDesc(car),
    acceleration,
    bootSpace,
    price: car.pricing.fullPrice.value,
    id: `https://www.cazoo.co.uk/car-details/${car.id}/`,
  });
  process.stdout.write(`\rFetched ${count++}/${cars.length}`);
}, 10);

q.push(cars);

await q.drain();

await fs.promises.writeFile("./scrapes/cazoo.json", JSON.stringify(speeds));

console.log("\nTop 15 fastest cars");
console.table(
  speeds
    .filter((x) => x.acceleration)
    .sort((a, b) => a.acceleration - b.acceleration)
    .slice(0, 15)
    .reduce((acc, { id, ...x }) => {
      acc[id] = x;
      return acc;
    }, {})
);

console.log("Cheapest cars with acceleration less than 8.2");
console.table(
  speeds
    .filter((x) => x.acceleration && x.acceleration < 8.2)
    .sort((a, b) => a.price - b.price)
    .slice(0, 15)
    .reduce((acc, { id, ...x }) => {
      acc[id] = x;
      return acc;
    }, {})
);
