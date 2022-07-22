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
WORKDIR $GOPATH/src/pleo.io/invoice-app/
COPY . .
RUN go get -d -v
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /go/bin/invoice-app

FROM scratch

COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group
COPY --from=builder /go/bin/invoice-app /go/bin/invoice-app
USER appuser:appuser
EXPOSE 8081
ENTRYPOINT ["/go/bin/invoice-app"]
