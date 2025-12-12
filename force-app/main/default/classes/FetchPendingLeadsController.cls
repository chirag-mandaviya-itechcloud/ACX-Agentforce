public with sharing class FetchPendingLeadsController {
    
    public class Output {
        @InvocableVariable
        public Integer pendingLeadCount;
    }
    
    @InvocableMethod(label='Get All Pending Leads from ACX Org' description='Fetch all pending leads from ACX Org')
    public static List<Output> getAllProjectNames(List<String> requests) {
    	List<Output> responses = new List<Output>();
		Output response = new Output();
        
        try {
            String soql = 'SELECT COUNT() FROM Lead WHERE Status IN (\'New Enquiry\')';
            HttpRequest req = new HttpRequest();
            
            req.setEndpoint(
                'callout:ACXNamedCredential/services/data/v61.0/query/?q=' +
                EncodingUtil.urlEncode(soql, 'UTF-8')
            );
            req.setMethod('GET');
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            if (res.getStatusCode() == 200){
                Map<String, Object> jsonResponse = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                
                Object totalSizeObj = jsonResponse.get('totalSize');
                Integer count = Integer.valueOf(String.valueOf(totalSizeObj));
                response.pendingLeadCount = count;
                responses.add(response);
            } else {
                System.debug('Failed to fetch count: ' + res.getStatusCode() + ' → ' + res.getBody());
                response.pendingLeadCount = -1; // error indicator
                responses.add(response);
            }
        } catch (Exception e) {
            System.debug('Exception: ' + e.getMessage());
            response.pendingLeadCount = -1; // error indicator
            responses.add(response);
        }
        
        return responses;
    }
}