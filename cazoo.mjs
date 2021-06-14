import axios from "axios";
import { JSDOM } from "jsdom";
import fs from "fs";
import { queue } from "async";

const fetchCars = true;
const queryName = "less-than-20k-suv-estate";
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

function writeFastest(car, acceleration) {
  console.log(`Fetched ${count}/${cars.length}`);
  count++;

  if (acceleration < fastest) {
    console.log(`Fastest is ${acceleration} - ${carDesc(car)}`);
    fastest = acceleration;
  }
}

const speeds = [];
let cars = [];
let response;
let i = 1;
let fastest = 100;
let count = 0;

if (fetchCars) {
  while ((response = await axios.get(search(i))).data.results.length > 0) {
    cars.push(...response.data.results);
    console.log(`Fetched page ${i}`);
    i++;
  }

  await fs.promises.writeFile(
    `./scrapes/${queryName}-cars.json`,
    JSON.stringify(cars, null, "\t")
  );

  if (response.status !== 200) {
    console.log("Response was not 200", response);
  }
}

if (!fetchCars) {
  cars = JSON.parse(
    await fs.promises.readFile(`./scrapes/${queryName}-cars.json`)
  );
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
  writeFastest(car, acceleration);
}, 10);

q.push(cars);

await q.drain();

await fs.promises.writeFile(
  `./scrapes/${queryName}-acceleration.json`,
  JSON.stringify(speeds)
);

console.table(
  speeds
    .filter((x) => x.acceleration)
    .sort((a, b) => a.acceleration - b.acceleration)
    .slice(0, 30)
);
