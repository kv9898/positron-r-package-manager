installed <- installed.packages()
jsonlite::write_json(installed, "R/installed.json")

loaded <- loadedNamespaces()
jsonlite::write_json(loaded, "R/loaded.json")

data <- as.data.frame(installed.packages()[, c("Package", "Version")])
loaded <- loadedNamespaces()
data$loaded <- ifelse(data$Package %in% loaded, TRUE, FALSE)
