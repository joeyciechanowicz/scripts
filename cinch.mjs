#!/usr/bin/env node

import axios from "axios";
import { JSDOM } from "jsdom";
import fs from "fs";
import { queue } from "async";

const fetchCars = true;
const queryName = "less-than-20k-suv-estate";
const scrapePrefix = "./scrapes/cinch-";

const search = (pageNumber) =>
  `https://search.api.cinch.co.uk/vehicles?bodyType=estate%2Csuv&colour=&doors=&fromEngineSize=-1&fromPrice=-1&fromYear=-1&fuelType=&make=&mileage=-1&pageNumber=${pageNumber}&pageSize=60&seats=&selectedModel=&sortingCriteria=1&toEngineSize=-1&toPrice=20000&toYear=-1&transmissionType=auto&useMonthly=false&variant=`;
const carUrl = (carId) => `https://product.api.cinch.co.uk/vehicles/${carId}`;

const carDesc = (car) =>
  `${car.make} ${car.selectedModel} ${car.trim} (${car.vehicleYear})`;

const speeds = [];
let cars = [];
let response;
let i = 1;
let fastest = 100;
let count = 0;

if (fetchCars) {
  while (
    (response = await axios.get(search(i))).data.vehicleListings.length > 0
  ) {
    cars.push(...response.data.vehicleListings);
    console.log(
      `Fetched page ${i}/${Math.floor(response.data.searchResultsCount / 60)}`
    );
    i++;
  }

  await fs.promises.writeFile(
    `${scrapePrefix}${queryName}-cars.json`,
    JSON.stringify(cars, null, "\t")
  );

  if (response.status !== 200) {
    console.log("Response was not 200", response);
  }
}

if (!fetchCars) {
  cars = JSON.parse(
    await fs.promises.readFile(`${scrapePrefix}${queryName}-cars.json`)
  );
}

function writeFastest(car, acceleration) {
  console.log(`Fetched ${count}/${cars.length}`);
  count++;

  if (acceleration < fastest) {
    console.log(`Fastest is ${acceleration} - ${carDesc(car)}`);
    fastest = acceleration;
  }
}

const q = queue(async (car) => {
  const carResponse = await axios.get(carUrl(car.vehicleId));

  if (carResponse.status !== 200) {
    console.log(`Failed to fetch car from ${carUrl(car.vehicleId)}`);
    return;
  }

  const perfData = carResponse.data.techData.filter(
    (x) => x.category === "Performance"
  )[0].items;
  const acceleration = Number(
    perfData.filter((x) => x.label === "0 to 62 mph (secs)")[0].value
  );

  speeds.push({
    makeModel: carDesc(car),
    acceleration,
    price: carResponse.data.price,
    id: `https://www.cinch.co.uk/used-cars/${car.make.toLowerCase()}/${car.selectedModel.toLowerCase()}/details/${
      car.vehicleId
    }`,
  });
  writeFastest(car, acceleration);
}, 10);

q.push(cars);

q.error((e) => {
  console.log("Unhandled error", e);
});

await q.drain();

console.log(`Writing speeds ${speeds.length} to file`);

await fs.promises.writeFile(
  `${scrapePrefix}${queryName}-acceleration.json`,
  JSON.stringify(speeds)
);

console.table(
  speeds
    .filter((x) => x.acceleration)
    .sort((a, b) => a.acceleration - b.acceleration)
    .slice(0, 30)
);
