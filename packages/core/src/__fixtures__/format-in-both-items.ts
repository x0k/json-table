export default {
  "name": "deduplicate headers with format in both items",
  "input": [
    {
      "options": { "reduceOptions": { "values": false } },
      "pluginVersion": "7.3.1",
      "targets": [{ "expr": "loki_build_info", "format": "table" }]
    },
    {
      "options": { "reduceOptions": { "values": false } },
      "pluginVersion": "7.3.2",
      "targets": [{ "expr": "sum_messages", "format": "json" }]
    }
  ]
};
