#!/usr/bin/env node

import axios from "axios";
import { queue } from "async";

const search = (pageNumber) =>
  `https://search.api.cinch.co.uk/vehicles?bodyType=estate%2Csuv&colour=&doors=&fromEngineSize=-1&fromPrice=-1&fromYear=-1&fuelType=&make=&mileage=-1&pageNumber=${pageNumber}&pageSize=60&seats=&selectedModel=&sortingCriteria=1&toEngineSize=-1&toPrice=20000&toYear=-1&transmissionType=auto&useMonthly=false&variant=`;
const carUrl = (carId) => `https://product.api.cinch.co.uk/vehicles/${carId}`;
const viewUrl = (make, selectedModel, vehicleId) =>
  `https://www.cinch.co.uk/used-cars/${encodeURIComponent(
    make.toLowerCase()
  )}/${encodeURIComponent(selectedModel.toLowerCase())}/details/${vehicleId}`;

const carDesc = (car) =>
  `${car.make} ${car.selectedModel} ${car.trim} (${car.vehicleYear})`;

const speeds = [];
let cars = [];
let response;
let i = 1;
let fastest = 100;
let count = 0;

while (
  (response = await axios.get(search(i))).data.vehicleListings.length > 0
) {
  cars.push(...response.data.vehicleListings);
  console.log(
    `Fetched page ${i}/${Math.floor(response.data.searchResultsCount / 60)}`
  );
  i++;
}

if (response.status !== 200) {
  console.log("Response was not 200", response);
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
    perfData.filter(
      (x) =>
        x.label === "0 to 62 mph (secs)" || x.label === "0 to 60 mph (secs)"
    )[0].value
  );

  speeds.push({
    makeModel: carDesc(car).substr(0, 50),
    "0-62": acceleration,
    price: `£${carResponse.data.price}`,
    id: viewUrl(car.make, car.selectedModel, car.vehicleId),
  });
  console.log(`Fetched ${count++}/${cars.length}`);
}, 10);

q.push(cars);

q.error((e) => {
  console.log("Unhandled error", e);
});

await q.drain();

console.log(`Writing speeds ${speeds.length} to file`);

console.table(
  speeds
    .filter((x) => x["0-62"])
    .sort((a, b) => a["0-62"] - b["0-62"])
    .slice(0, 30)
);
