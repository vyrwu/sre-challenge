package integration_invoices

import (
	"bytes"
	"time"
	"fmt"
	"flag"
	"testing"
	"log"
	"net/http"
	"io/ioutil"
	"encoding/json"
	"os/exec"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type integrationTestSuite struct {
	suite.Suite
	apiURL string
}

/*
  TODO: Invoice and Invoice Payment should come from a dependent module 'github.com/vyrwu/sre-challenge/invoice-app/db'.
	However, I'm stuck on this error and am not sure how to proceed. I'm guessing that the module naming requires a
	refactor:
	❯ go get github.com/vyrwu/sre-challenge/invoice-app/db
	go get: github.com/vyrwu/sre-challenge/invoice-app@v0.0.0-20220627145221-d3f6fe503f6d: parsing go.mod:
	        module declares its path as: pleo.io/invoice-app
	                but was required as: github.com/vyrwu/sre-challenge/invoice-app
*/
type Invoice struct {
	InvoiceId string
	Value     float32
	Currency  string
	IsPaid    bool
}

type InvoicePayment struct {
	InvoiceId string
	Value     float32
	Currency  string
}

var k8sDeploymentName = "invoice-app"
var k8sAppContainerPort = 8081
var k8sAppLocalhostURL = fmt.Sprintf("http://localhost:%d", k8sAppContainerPort)

var apiURL = flag.String("apiURL", k8sAppLocalhostURL, fmt.Sprintf("URL under which the API is hosted. Default: %s", k8sAppLocalhostURL))

func TestIntegrationTestSuite(t *testing.T) {
	log.Printf("Running integration tests with apiURL = %s", *apiURL)
	suite.Run(t, &integrationTestSuite{
		apiURL: *apiURL,
	})
}

// TestInvoicesPay pays all the unpaid invoices.
func (s *integrationTestSuite) TestInvoicesPay() {
	var c = &http.Client{Timeout: 10 * time.Second}

	ivs, err := getInvoices(s, c)
	if err != nil {
		log.Fatal(err)
	}

	for _, iv := range ivs {
		assert.Equal(s.T(), false, iv.IsPaid)
	}

	log.Printf("All invoices unpaid. Paying...")
	invoicesPayURL := fmt.Sprintf("%s/invoices/pay", s.apiURL)
	for _, iv := range ivs {
		ivp, err := json.Marshal(InvoicePayment{
			InvoiceId: iv.InvoiceId,
			Currency: iv.Currency,
			Value: iv.Value,
		})
		if (err != nil) {
			log.Fatal(err)
		}

		resp, err := http.Post(invoicesPayURL, "application/json", bytes.NewBuffer(ivp))
		if (err != nil) {
			log.Fatal(err)
		}

		assert.Equal(s.T(), http.StatusOK, resp.StatusCode)
		log.Printf("POST %s -d '%s' => %d OK", invoicesPayURL, bytes.NewBuffer(ivp), http.StatusOK)
	}
	
	ivs, err = getInvoices(s, c)
	if err != nil {
		log.Fatal(err)
	}

	for _, iv := range ivs {
		assert.Equal(s.T(), true, iv.IsPaid)
	}
	log.Printf("All invoices paid. Success!")
}

// TearDownSuite restarts the deployment of 'invoice-app' as it runs in-memory DB.
// Normally, this would not be needed, and instead, test would create and tear down
// it's own resources using CRUD endpoints of the API. Doing this is in fact insecure,
// as the current context might be pointing at a production workload. I implemented this
// solely for the sake of convinience.
func (s *integrationTestSuite) TearDownSuite() {
	out, err := exec.Command("kubectl", "rollout", "restart", "deployment/invoice-app", "-n", "invoices").Output()
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("%s", out)
}

func getInvoices(s *integrationTestSuite, c *http.Client) ([]Invoice, error) {
	invoicesURL := fmt.Sprintf("%s/invoices", s.apiURL)
	resp, err := c.Get(invoicesURL)
	if err != nil {
		return nil, err
	}
	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)
	log.Printf("GET %s => %d OK", invoicesURL, http.StatusOK)
	body, err := ioutil.ReadAll(resp.Body)
	defer resp.Body.Close()
	if err != nil {
		return nil, err
	}
	var jb []Invoice
	if err := json.Unmarshal(body, &jb); err != nil {
		return nil, err
	}
	return jb, nil
}
