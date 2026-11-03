// Scheduled Indian airports used by the flight search provider.
// Coordinates are airport reference points, not aircraft tracking data.
// Dataset source: OurAirports public-domain airport data.
const AIRPORTS = {
  AGR: [27.1558, 77.9609], AMD: [23.0772, 72.6347], ATQ: [31.7096, 74.7973], AYJ: [26.7606, 82.1540],
  BLR: [13.1986, 77.7066], BHO: [23.2875, 77.3374], BBI: [20.2444, 85.8178], IXC: [30.6735, 76.7885],
  MAA: [12.9941, 80.1709], CJB: [11.0300, 77.0434], DED: [30.1897, 78.1803], DEL: [28.55563, 77.09519],
  GOI: [15.3808, 73.8314], GAU: [26.1061, 91.5859], HYD: [17.2403, 78.4294], IDR: [22.7218, 75.8011],
  JLR: [23.1778, 80.0520], JAI: [26.8242, 75.8122], IXJ: [32.6891, 74.8374], JDH: [26.2511, 73.0489],
  KNU: [26.4043, 80.4101], COK: [10.1520, 76.4019], CCU: [22.6547, 88.4467], LKO: [26.7606, 80.8893],
  IXM: [9.8345, 78.0934], IXE: [12.9613, 74.8901], BOM: [19.0896, 72.8656], NAG: [21.0922, 79.0472],
  PAT: [25.5913, 85.0880], PNQ: [18.5821, 73.9197], IXR: [23.3143, 85.3217], SXR: [33.9871, 74.7742],
  STV: [21.1141, 72.7418], TRV: [8.4821, 76.9201], UDR: [24.6177, 73.8961], BDQ: [22.3362, 73.2263],
  VNS: [25.4524, 82.8593], VTZ: [17.7212, 83.2245], GWL: [26.2933, 78.2278],
};

exports.airportPoint = (code) => {
  const iata = String(code || "").trim().toUpperCase();
  const coords = AIRPORTS[iata];
  return coords ? { latitude: coords[0], longitude: coords[1], code: iata, coordinateSource: "OurAirports reference coordinates" } : null;
};
