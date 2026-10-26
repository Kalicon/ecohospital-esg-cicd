package br.com.ecohospital;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features")
@ConfigurationParameter(key = "cucumber.glue", value = "br.com.ecohospital")
@ConfigurationParameter(key = "cucumber.plugin", value = "pretty,html:target/cucumber-report.html,json:target/cucumber-report.json,junit:target/cucumber-junit.xml")
public class BddTest {}
