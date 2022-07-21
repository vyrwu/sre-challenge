FROM golang:1.18-alpine3.15 AS builder

ENV USER=appuser
ENV UID=10001
RUN adduser \
  --disabled-password \
  --gecos "" \
  --home "/nonexistent" \
  --shell "/sbin/nologin" \
  --no-create-home \
  --uid "${UID}" \
  "${USER}"

RUN apk update && apk add --no-cache git
WORKDIR $GOPATH/src/pleo.io/payment-provider/
COPY . .
RUN go get -d -v
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /go/bin/payment-provider

FROM scratch

COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group
COPY --from=builder /go/bin/payment-provider /go/bin/payment-provider
USER appuser:appuser
ENTRYPOINT ["/go/bin/payment-provider"]
