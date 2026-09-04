import { joinPrimitiveArrayValues } from "../json-to-tree.js";

export default {
  "name": "departments and projects with primitive join",
  "options": {
    "collapseIndexes": true,
    "joinArrayValues": joinPrimitiveArrayValues,
  },
  "input": {
    "departments": [
      {
        "name": "Research",
        "employees": [
          {
            "name": "Charlie",
            "position": "Research Scientist"
          },
          {
            "name": "Diana",
            "position": "Research Analyst"
          }
        ]
      },
      {
        "name": "Development",
        "employees": [
          {
            "name": "Eva",
            "position": "Software Engineer"
          },
          {
            "name": "Frank",
            "position": "UI/UX Designer"
          }
        ]
      },
      {
        "name": "Marketing",
        "employees": [
          {
            "name": "Grace",
            "position": "Marketing Manager"
          },
          {
            "name": "Harry",
            "position": "Social Media Specialist"
          }
        ]
      }
    ],
    "projects": [
      {
        "title": "Project A",
        "team": [
          "Alice",
          "Charlie",
          "Eva"
        ],
        "progress": 75
      },
      {
        "title": "Project B",
        "team": [
          "Bob",
          "Diana",
          "Frank"
        ],
        "progress": 60
      },
      {
        "title": "Project C",
        "team": [
          "Charlie",
          "Eva",
          "Grace"
        ],
        "progress": 90
      }
    ]
  }
};
