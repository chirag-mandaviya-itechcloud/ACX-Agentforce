public class FetchBookingDetailsController {
    public class Request {
        @InvocableVariable(required=false)
        public String requeststring;
    }
    
    public class Output {
        @InvocableVariable public Id bookingId;
        @InvocableVariable public String bookingName;
        @InvocableVariable public Id ownerId;
        @InvocableVariable public String ownerName;
        @InvocableVariable public Date bookingDate;
        @InvocableVariable public String towerName;
        @InvocableVariable public String unitName;
    }
    
    public class Response {
        @InvocableVariable public String result;
    }
    
    @InvocableMethod(label='Get Booking Details for Last Month' description='Returns the Booking__c details')
    public static List<Response> getBookingDetails(List<Request> requests) {
        List<Output> outputs = new List<Output>();
        List<Response> results = new List<Response>();
        
        for (Request req : requests) {
            Response res = new Response();
            try {
                String soql = 'SELECT Id, Name, OwnerId, Owner.Name, Booking_Date__c, Unit__r.Name, Unit__r.Tower__r.Name FROM Booking__c WHERE Booking_Date__c = LAST_MONTH';
                HttpRequest reqApi = new HttpRequest();
                
                reqApi.setEndpoint(
                    'callout:ACXNamedCredential/services/data/v61.0/query/?q=' +
                    EncodingUtil.urlEncode(soql, 'UTF-8')
                );
                reqApi.setMethod('GET');
                
                Http http = new Http();
                HttpResponse resApi = http.send(reqApi);
                
                if (resApi.getStatusCode() == 200) {
                    Map<String, Object> jsonResponse =
                        (Map<String, Object>) JSON.deserializeUntyped(resApi.getBody());
                    
                    System.debug('jsonResponse : '+ jsonResponse);
                    
                    List<Object> records = (List<Object>) jsonResponse.get('records');
                    
                    System.debug('records: '+records);
                    
                    for (Object objRec : records) {
                        Map<String, Object> rec = (Map<String, Object>) objRec;
                        Output row = new Output();
                        
                        row.bookingId = (Id) rec.get('Id');
                        row.bookingName = (String) rec.get('Name');
                        row.ownerId     = (Id) rec.get('OwnerId');
                        
                        Map<String, Object> ownerWrapper = (Map<String, Object>) rec.get('Owner');
                        row.ownerName = ownerWrapper != null ? (String) ownerWrapper.get('Name') : null;
                        
                        if (rec.containsKey('Booking_Date__c') && rec.get('Booking_Date__c') != null) {
                            row.bookingDate = Date.valueOf((String) rec.get('Booking_Date__c'));
                        }
                        
                        String unitName = null;
                        String towerName = null;
                        if (rec.containsKey('Unit__r') && rec.get('Unit__r') != null) {
                            Map<String, Object> unitWrapper = 
                                (Map<String, Object>) rec.get('Unit__r');
                            
                            if (unitWrapper.containsKey('Name')) {
                                unitName = (String) unitWrapper.get('Name');
                            }
                            
                            if (unitWrapper.containsKey('Tower__r') && unitWrapper.get('Tower__r') != null) {
                                Map<String, Object> towerWrapper =
                                    (Map<String, Object>) unitWrapper.get('Tower__r');
                                
                                towerName = (String) towerWrapper.get('Name');
                            }
                        }
                        row.unitName = unitName;
                        row.towerName = towerName;
                        
                        
                        outputs.add(row);
                    }
                    res.result = JSON.serializePretty(outputs);
                } else {
                    System.debug('Callout Failed: ' + resApi.getStatusCode() + ' → ' + resApi.getBody());
                    res.result = '[]';
                }
            } catch (Exception e) {
                System.debug('Exception: ' + e.getMessage());
                res.result = '[]';
            }
            results.add(res);
        }
        return results;
    }
}