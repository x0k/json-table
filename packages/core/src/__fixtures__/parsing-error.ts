import { joinPrimitiveArrayValues } from "../json-to-tree.js";

export default {
  "name": "combine simple values without affecting object values",
  "options": {
    "joinArrayValues": joinPrimitiveArrayValues
  },
  "input": {
    "weather": [
      {
        "id": 800,
        "main": "Clear",
        "description": "clear sky",
        "icon": "01n"
      }
    ]
  }
};
