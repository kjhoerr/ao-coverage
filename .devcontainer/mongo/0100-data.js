
db.createCollection("repository");
db.repository.insertMany([
  {
    organization: "kjhoerr",
    name: "ao-coverage",
    branches: {
      "trunk": {
        head: {
          commit: "400ab021c92101bc6db1f70fba41e673de7ee14a",
          format: "cobertura"
        }
      }
    }
  }
]);